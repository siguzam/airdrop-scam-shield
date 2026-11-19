export type Verdict = "SAFE" | "SUSPICIOUS" | "DANGER";

export type InferenceSource = "ON_DEVICE" | "IN_CLOUD";

export type Severity = "high" | "medium" | "low";

export interface AiFlag {
  label: string;
  explanation: string;
}

export interface TriageResult {
  score: number;
  verdict: Verdict;
  flags: AiFlag[];
  summary: string;
  source: InferenceSource;
  modelLabel: string;
}

export interface LocalFlag {
  id: string;
  label: string;
  severity: Severity;
  explanation: string;
  match: string | null;
}

export interface LocalResult {
  score: number;
  verdict: Verdict;
  flags: LocalFlag[];
}

export interface DexPairInfo {
  dex: string;
  pairAddress: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  txns24h: number | null;
}

export interface OnChainFacts {
  address: string;
  isContract: boolean | null;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  sourcifyVerified: boolean | null;
  pairs: DexPairInfo[];
  errors: string[];
}

export interface HistoryEntry {
  id: string;
  ts: number;
  input: string;
  local: LocalResult;
  triage: TriageResult | null;
  deep: TriageResult | null;
  facts: OnChainFacts | null;
}
