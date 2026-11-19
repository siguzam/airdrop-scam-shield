import {
  getGenerativeModel,
  InferenceMode,
  Schema,
} from "firebase/ai";
import { getFirebaseAI } from "./firebase";
import type { InferenceSource, TriageResult, Verdict } from "./types";

const triageSchema = Schema.object({
  properties: {
    score: Schema.integer({
      description: "Risk score from 0 (safe) to 100 (certain scam).",
    }),
    verdict: Schema.enumString({
      enum: ["SAFE", "SUSPICIOUS", "DANGER"],
      description: "Overall verdict for the pasted message.",
    }),
    flags: Schema.array({
      items: Schema.object({
        properties: {
          label: Schema.string({
            description: "Short name of the red flag.",
          }),
          explanation: Schema.string({
            description: "One or two sentences explaining why this is suspicious.",
          }),
        },
      }),
      description: "List of red flags found in the message.",
    }),
    summary: Schema.string({
      description:
        "Two or three sentences summarizing the risk for a non-technical user.",
    }),
  },
});

function normalizeSource(raw: unknown): InferenceSource {
  const text = String(raw ?? "").toUpperCase();
  return text.includes("DEVICE") ? "ON_DEVICE" : "IN_CLOUD";
}

function parseTriageJson(text: string): Omit<TriageResult, "source" | "modelLabel"> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The AI answer was not valid JSON. Please try again.");
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("The AI answer had an unexpected shape. Please try again.");
  }
  const obj = data as Record<string, unknown>;
  const rawScore = typeof obj.score === "number" ? obj.score : 50;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const verdict: Verdict =
    obj.verdict === "SAFE" || obj.verdict === "SUSPICIOUS" || obj.verdict === "DANGER"
      ? obj.verdict
      : score >= 70
        ? "DANGER"
        : score >= 35
          ? "SUSPICIOUS"
          : "SAFE";
  const flags = Array.isArray(obj.flags)
    ? obj.flags
        .filter(
          (f): f is Record<string, unknown> =>
            typeof f === "object" && f !== null,
        )
        .map((f) => ({
          label: typeof f.label === "string" ? f.label : "Suspicious pattern",
          explanation:
            typeof f.explanation === "string"
              ? f.explanation
              : "The model flagged this without details.",
        }))
    : [];
  const summary =
    typeof obj.summary === "string" && obj.summary.length > 0
      ? obj.summary
      : "The model did not return a summary.";
  return { score, verdict, flags, summary };
}

function buildTriagePrompt(input: string, localFlags: string[]): string {
  const localBlock =
    localFlags.length > 0
      ? `A fast local pre-check already found these red flags:\n- ${localFlags.join("\n- ")}`
      : "A fast local pre-check found no classic scam patterns.";
  return [
    "You are Airdrop Scam Shield, a security assistant that protects crypto users from airdrop scams.",
    "Analyze the pasted message below and judge how likely it is a scam.",
    "Score guide: 0 to 30 SAFE, 31 to 69 SUSPICIOUS, 70 to 100 DANGER.",
    "Be strict with anything asking for funds, wallet connections, signatures, seed phrases, or verification payments.",
    "Be fair to real announcements: a plain project update with no request for money or access is not a scam.",
    localBlock,
    "Message to analyze:",
    `"""${input}"""`,
    "Answer with JSON only, matching the requested schema.",
  ].join("\n\n");
}

function buildDeepPrompt(
  input: string,
  onChainFactsText: string | null,
  localFlags: string[],
): string {
  const factsBlock = onChainFactsText
    ? `On-chain facts gathered live from public BSC sources:\n${onChainFactsText}`
    : "No contract address was found in the message, so no on-chain check was possible.";
  const localBlock =
    localFlags.length > 0
      ? `Local pre-check flags: ${localFlags.join(", ")}.`
      : "Local pre-check found no classic scam patterns.";
  return [
    "You are Airdrop Scam Shield, a security assistant that protects crypto users from airdrop scams.",
    "Do a deep analysis of the pasted message below. Weigh the on-chain facts heavily when a contract is involved:",
    "an unverified contract with no trading pair and no liquidity is very suspicious,",
    "while a verified contract with real liquidity lowers the contract risk, but the message itself can still be a scam.",
    "Also judge the social engineering: impersonation of known brands, urgency pressure, payment requests, and link tricks.",
    factsBlock,
    localBlock,
    "Message to analyze:",
    `"""${input}"""`,
    "Answer with JSON only, matching the requested schema. Put your deepest reasoning into the summary and flags.",
  ].join("\n\n");
}

/**
 * Warm up the on-device model (Gemini Nano) after a user click, so the first
 * triage prompt does not pay the download cost. Returns true when the
 * on-device model is ready, false when this device cannot run it. A false
 * result is not an error: PREFER_ON_DEVICE falls back to the cloud.
 */
export async function warmupDeviceModel(
  onProgress: (progress: number) => void,
): Promise<boolean> {
  const ai = getFirebaseAI();
  const model = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
  try {
    await model.initializeDeviceModel((progress) => {
      onProgress(typeof progress === "number" ? progress : 0);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Quick triage: one short prompt, PREFER_ON_DEVICE. Runs on Gemini Nano when
 * the device supports it and falls back to the cloud otherwise. The returned
 * `source` field says which one actually answered.
 */
export async function quickTriage(
  input: string,
  localFlags: string[],
): Promise<TriageResult> {
  const ai = getFirebaseAI();
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: triageSchema,
    },
  });
  const result = await model.generateContent(buildTriagePrompt(input, localFlags));
  const source = normalizeSource(result.response.inferenceSource);
  const parsed = parseTriageJson(result.response.text());
  return {
    ...parsed,
    source,
    modelLabel:
      source === "ON_DEVICE" ? "Gemini Nano (on-device)" : "Gemini (cloud fallback)",
  };
}

/**
 * Deep analysis: runs in the cloud on purpose, because it needs the strongest
 * model and the live on-chain facts gathered before the call.
 */
export async function deepAnalysis(
  input: string,
  onChainFactsText: string | null,
  localFlags: string[],
): Promise<TriageResult> {
  const ai = getFirebaseAI();
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_IN_CLOUD,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: triageSchema,
    },
  });
  const result = await model.generateContent(
    buildDeepPrompt(input, onChainFactsText, localFlags),
  );
  const source = normalizeSource(result.response.inferenceSource);
  const parsed = parseTriageJson(result.response.text());
  return {
    ...parsed,
    source,
    modelLabel: "Gemini (cloud)",
  };
}
