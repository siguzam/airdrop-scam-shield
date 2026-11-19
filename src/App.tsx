import { useState } from "react";
import { isFirebaseConfigured } from "./firebase";
import { deepAnalysis, quickTriage, warmupDeviceModel } from "./ai";
import {
  extractBscAddress,
  fetchOnChainFacts,
  formatOnChainFactsForPrompt,
  localPreCheck,
  recommendedActions,
} from "./scan";
import { clearHistory, loadHistory, saveHistoryEntry } from "./history";
import type {
  HistoryEntry,
  LocalResult,
  OnChainFacts,
  TriageResult,
  Verdict,
} from "./types";
import VerdictCard from "./components/VerdictCard";
import FlagsList, { type DisplayFlag } from "./components/FlagsList";
import OnChainCard from "./components/OnChainCard";
import HistoryPanel from "./components/HistoryPanel";

type Phase = "idle" | "warming" | "triaging" | "deep" | "done";

const SCAM_SAMPLE =
  "🚀 BINANCE OFFICIAL GIVEAWAY! Send 0.5 BNB and get 1 BNB back instantly! Only 100 spots left, hurry! Verify your wallet now to claim your free 500 USDT airdrop. Connect your wallet and pay the small verification fee of 0.01 BNB. Limited time offer ends tonight!";

const SAFE_SAMPLE =
  "Uniswap Governance: Proposal #42 is now live for voting on the official governance forum at gov.uniswap.org. Token holders can vote with their UNI. No funds are required to vote. Never share your seed phrase with anyone.";

const CONTRACT_SAMPLE =
  "Check out this new token: 0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82 (PancakeSwap CAKE). The team says a big airdrop is coming for holders. Claim at the official site only.";

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Unknown error.";
  if (msg.includes("Firebase is not configured")) {
    return msg;
  }
  if (/app check/i.test(msg)) {
    return "App Check rejected the request. In local dev, register the debug token printed in the browser console (Firebase console -> App Check -> Manage debug tokens).";
  }
  return `The AI request failed (${msg}). The local pre-check above still applies.`;
}

function localSummary(local: LocalResult): string {
  if (local.flags.length === 0) {
    return "No classic scam patterns found in the instant check. This is only a first pass — the AI triage below looks deeper.";
  }
  return `Found ${local.flags.length} classic scam pattern${local.flags.length > 1 ? "s" : ""} in the instant check. See the flags below.`;
}

export default function App() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [warmup, setWarmup] = useState({
    progress: 0,
    done: false,
    available: null as boolean | null,
  });
  const [local, setLocal] = useState<LocalResult | null>(null);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [deep, setDeep] = useState<TriageResult | null>(null);
  const [facts, setFacts] = useState<OnChainFacts | null>(null);
  const [factsLoading, setFactsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  const busy =
    phase === "warming" || phase === "triaging" || phase === "deep";
  const address = extractBscAddress(input);
  const finalVerdict: Verdict | null =
    deep?.verdict ?? triage?.verdict ?? local?.verdict ?? null;

  function storeEntry(
    id: string,
    text: string,
    localResult: LocalResult,
    triageResult: TriageResult | null,
    deepResult: TriageResult | null,
    factsResult: OnChainFacts | null,
  ) {
    const entry: HistoryEntry = {
      id,
      ts: Date.now(),
      input: text,
      local: localResult,
      triage: triageResult,
      deep: deepResult,
      facts: factsResult,
    };
    setHistory(saveHistoryEntry(entry));
  }

  async function handleScan() {
    const text = input.trim();
    if (!text) {
      setError("Paste an airdrop message, a link, or a BSC contract address first.");
      return;
    }
    setError(null);
    setDeep(null);
    setFacts(null);
    setTriage(null);
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCurrentEntryId(entryId);

    const localResult = localPreCheck(text);
    setLocal(localResult);

    if (!isFirebaseConfigured) {
      setPhase("done");
      storeEntry(entryId, text, localResult, null, null, null);
      return;
    }

    setPhase("warming");
    setWarmup({ progress: 0, done: false, available: null });
    try {
      const available = await warmupDeviceModel((p) =>
        setWarmup((w) => ({ ...w, progress: p })),
      );
      setWarmup({ progress: 1, done: true, available });
    } catch {
      setWarmup({ progress: 0, done: true, available: false });
    }

    setPhase("triaging");
    try {
      const result = await quickTriage(
        text,
        localResult.flags.map((f) => f.label),
      );
      setTriage(result);
      setPhase("done");
      storeEntry(entryId, text, localResult, result, null, null);
    } catch (e) {
      setError(friendlyError(e));
      setPhase("done");
    }
  }

  async function handleDeep() {
    if (!triage || !local) {
      return;
    }
    setError(null);
    setPhase("deep");
    let factsResult: OnChainFacts | null = facts;
    const foundAddress = extractBscAddress(input);
    if (foundAddress && !factsResult) {
      setFactsLoading(true);
      try {
        factsResult = await fetchOnChainFacts(foundAddress);
        setFacts(factsResult);
      } catch {
        setError(
          "Could not fetch on-chain data. Deep analysis continues without it.",
        );
        factsResult = null;
      } finally {
        setFactsLoading(false);
      }
    }
    try {
      const factsText = factsResult
        ? formatOnChainFactsForPrompt(factsResult)
        : null;
      const result = await deepAnalysis(
        input,
        factsText,
        local.flags.map((f) => f.label),
      );
      setDeep(result);
      setPhase("done");
      if (currentEntryId) {
        storeEntry(
          currentEntryId,
          input.trim(),
          local,
          triage,
          result,
          factsResult,
        );
      }
    } catch (e) {
      setError(friendlyError(e));
      setPhase("done");
    }
  }

  function handleSelectHistory(entry: HistoryEntry) {
    setInput(entry.input);
    setLocal(entry.local);
    setTriage(entry.triage);
    setDeep(entry.deep);
    setFacts(entry.facts);
    setCurrentEntryId(entry.id);
    setError(null);
    setPhase("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  const localFlags: DisplayFlag[] = (local?.flags ?? []).map((f) => ({
    label: f.label,
    explanation: f.explanation,
    tag: f.severity.toUpperCase(),
  }));
  const triageFlags: DisplayFlag[] = (triage?.flags ?? []).map((f) => ({
    label: f.label,
    explanation: f.explanation,
    tag: "AI",
  }));
  const deepFlags: DisplayFlag[] = (deep?.flags ?? []).map((f) => ({
    label: f.label,
    explanation: f.explanation,
    tag: "AI DEEP",
  }));

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-badge">🛡️ #BuildHybridAI 2026</div>
        <h1>Airdrop Scam Shield</h1>
        <p className="hero-sub">
          Paste an airdrop message, a link, or a BSC contract address. Get an
          instant risk verdict from hybrid AI: fast and private on your device
          first, deep in the cloud when it matters.
        </p>
      </header>

      <section className="steps" aria-label="How it works">
        <div className="step">
          <span className="step-num">1</span>
          <h3>Instant pre-check</h3>
          <p>
            Runs in the browser with no network. Pattern matching catches seed
            phrase requests, send-to-get doubling, fake verification, and
            urgency tricks in milliseconds.
          </p>
        </div>
        <div className="step">
          <span className="step-num">2</span>
          <h3>Quick triage on-device</h3>
          <p>
            Gemini Nano judges the message on your device through Firebase AI
            Logic. Free, private, and offline. No on-device model? It falls
            back to the cloud and the badge says so.
          </p>
        </div>
        <div className="step">
          <span className="step-num">3</span>
          <h3>Deep analysis in the cloud</h3>
          <p>
            On your click only. If a BSC contract is present, the app first
            reads live on-chain facts, then the strongest cloud model weighs
            them in.
          </p>
        </div>
      </section>

      {!isFirebaseConfigured && (
        <div className="notice">
          <strong>Demo mode: Firebase is not configured.</strong>
          <p>
            Stage 1 instant pre-check works without any setup. To enable the
            AI stages, copy <code>.env.example</code> to{" "}
            <code>.env.local</code> and fill in your Firebase web app values.
            See the README for the steps.
          </p>
        </div>
      )}

      <section className="card scanner">
        <label htmlFor="scan-input">
          Airdrop message, link, or BSC contract address
        </label>
        <textarea
          id="scan-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste the Telegram message, tweet, or contract address here…"
          rows={6}
          disabled={busy}
        />
        <div className="samples">
          <span>Try a sample:</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setInput(SCAM_SAMPLE)}
            disabled={busy}
          >
            Obvious scam
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setInput(SAFE_SAMPLE)}
            disabled={busy}
          >
            Safe announcement
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setInput(CONTRACT_SAMPLE)}
            disabled={busy}
          >
            Token contract
          </button>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleScan}
            disabled={busy}
          >
            {busy ? "Scanning…" : "Scan now"}
          </button>
          {address && (
            <span className="address-note">
              Contract detected:{" "}
              <span className="mono">{address}</span>
            </span>
          )}
        </div>

        {phase === "warming" && (
          <div className="status">
            <p>
              Warming up the on-device model…{" "}
              {Math.round(warmup.progress * 100)}%
            </p>
            <div className="progress">
              <span style={{ width: `${warmup.progress * 100}%` }} />
            </div>
          </div>
        )}
        {phase === "triaging" && (
          <p className="status">Analyzing with Gemini Nano (on-device first)…</p>
        )}
        {phase === "deep" && (
          <p className="status">
            Running deep analysis in the cloud
            {factsLoading ? " (fetching on-chain facts first)" : ""}…
          </p>
        )}
        {warmup.done && warmup.available === false && (
          <p className="status muted">
            On-device model is not available on this device, so triage used
            the cloud fallback.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      {local && (
        <div className="results">
          <VerdictCard
            title="Stage 1 · Instant pre-check"
            score={local.score}
            verdict={local.verdict}
            summary={localSummary(local)}
          />
          <FlagsList
            title="Instant pre-check flags"
            flags={localFlags}
            emptyText="No classic scam patterns found."
          />
        </div>
      )}

      {triage && (
        <div className="results">
          <VerdictCard
            title="Stage 2 · Quick triage"
            score={triage.score}
            verdict={triage.verdict}
            summary={triage.summary}
            source={triage.source}
          />
          <FlagsList
            title="AI triage flags"
            flags={triageFlags}
            emptyText="The model found no additional flags."
          />
          {!deep && phase !== "deep" && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDeep}
              disabled={busy}
            >
              Run deep analysis
              {address ? " (with on-chain check)" : ""}
            </button>
          )}
        </div>
      )}

      {(factsLoading || facts) && (
        <OnChainCard facts={facts} loading={factsLoading} />
      )}

      {deep && (
        <div className="results">
          <VerdictCard
            title="Stage 3 · Deep analysis"
            score={deep.score}
            verdict={deep.verdict}
            summary={deep.summary}
            source={deep.source}
          />
          <FlagsList
            title="Deep analysis flags"
            flags={deepFlags}
            emptyText="The deep analysis found no additional flags."
          />
        </div>
      )}

      {finalVerdict && (
        <section className="card next-steps">
          <h3>What to do next</h3>
          <ul>
            {recommendedActions(finalVerdict).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <HistoryPanel
        entries={history}
        onSelect={handleSelectHistory}
        onClear={handleClearHistory}
      />

      <footer className="footer">
        <p>
          Airdrop Scam Shield is an educational demo built for the
          #BuildHybridAI 2026 hackathon. It is not financial advice. Always
          verify through official channels before connecting a wallet or
          sending funds.
        </p>
        <p>
          Hybrid AI: on-device Gemini Nano first, cloud Gemini when needed —
          powered by Firebase AI Logic.
        </p>
      </footer>
    </div>
  );
}
