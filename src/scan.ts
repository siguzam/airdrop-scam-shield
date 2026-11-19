import type {
  DexPairInfo,
  LocalFlag,
  LocalResult,
  OnChainFacts,
  Severity,
  Verdict,
} from "./types";

/* ------------------------------------------------------------------ */
/* Stage 1: instant local pre-check (no AI, no network)               */
/* ------------------------------------------------------------------ */

interface LocalRule {
  id: string;
  label: string;
  severity: Severity;
  weight: number;
  explanation: string;
  test: (input: string) => string | null;
}

function firstMatch(input: string, re: RegExp): string | null {
  const m = input.match(re);
  return m ? m[0].slice(0, 120) : null;
}

const RULES: LocalRule[] = [
  {
    id: "seed-phrase",
    label: "Asks for seed phrase or private key",
    severity: "high",
    weight: 70,
    explanation:
      "No legitimate airdrop ever asks for your seed phrase or private key. Anyone with them can empty your wallet instantly. Warnings that tell you never to share them do not trigger this flag.",
    test: (input) => {
      // Check sentence by sentence so that warnings such as
      // "Never share your seed phrase" do not trigger the flag.
      const sentences = input.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        if (/(never|don't|do not|keep your|protect your)/i.test(s)) {
          continue;
        }
        const m = s.match(
          /(share|send|enter|provide|give|submit|reveal|paste|type|input|confirm|verify|import).{0,50}(seed\s*phrase|private\s*key|mnemonic|recovery\s*phrase)|(seed\s*phrase|private\s*key|mnemonic|recovery\s*phrase).{0,50}(share|send|enter|provide|give|submit|reveal|paste|type|input|confirm|verify|import)/i,
        );
        if (m) {
          return m[0].slice(0, 120);
        }
      }
      return null;
    },
  },
  {
    id: "send-to-get",
    label: "Send crypto to receive more back",
    severity: "high",
    weight: 35,
    explanation:
      "Classic doubling scam. Real airdrops never ask you to send funds first to unlock a reward.",
    test: (input) => {
      const send = firstMatch(
        input,
        /send\s+[\d.,]+\s*(bnb|eth|usdt|usdc|sol|trx|ton)\b/i,
      );
      const back = firstMatch(
        input,
        /get\s+back|receive\s+back|get\s+\d[\d.,]*\s*(bnb|eth|usdt|usdc|sol|trx|ton)?\s*back|double|2x|twice\s+the\s+amount/i,
      );
      return send && back ? `${send} + ${back}` : null;
    },
  },
  {
    id: "guaranteed-returns",
    label: "Guaranteed daily returns",
    severity: "high",
    weight: 30,
    explanation:
      "Promises of fixed daily profit are a hallmark of Ponzi schemes. Markets never guarantee returns.",
    test: (input) =>
      firstMatch(
        input,
        /(\d+(\.\d+)?)\s*%\s*(per|a|an|every)?\s*(day|daily|hour|hourly|week)/i,
      ) ?? firstMatch(input, /guaranteed\s+(profit|return|income)/i),
  },
  {
    id: "fake-verification",
    label: "Fake verification step",
    severity: "high",
    weight: 25,
    explanation:
      "Scammers add a fake verification step to make a theft look official. Real claims do not need a verification payment.",
    test: (input) => {
      const verify = firstMatch(
        input,
        /verif(y|ication)\s+(your\s+)?(wallet|account)|verify\s+to\s+claim|human\s+verification/i,
      );
      const pay = firstMatch(input, /pay|fee|deposit|send\s+[\d.,]+/i);
      return verify && pay ? `${verify} + ${pay}` : null;
    },
  },
  {
    id: "connect-wallet-pay",
    label: "Connect wallet plus a payment",
    severity: "high",
    weight: 25,
    explanation:
      "Connecting a wallet is normal, but a site that demands a payment right after the connection is usually a drainer.",
    test: (input) => {
      const connect = firstMatch(input, /connect\s+(your\s+)?wallet/i);
      const pay = firstMatch(
        input,
        /pay|fee|deposit|activation|gas\s*fee/i,
      );
      return connect && pay ? `${connect} + ${pay}` : null;
    },
  },
  {
    id: "sign-to-claim",
    label: "Asks you to sign to claim",
    severity: "high",
    weight: 30,
    explanation:
      "A signature can authorize a token approval that drains a wallet. Never sign a message just to claim an airdrop.",
    test: (input) =>
      firstMatch(
        input,
        /sign\s+(the\s+)?(message|transaction|approval)|sign\s+.*to\s+claim|claim\s+.*sign/i,
      ),
  },
  {
    id: "impersonation",
    label: "Claims to be an official account",
    severity: "medium",
    weight: 20,
    explanation:
      "Scammers impersonate Binance, PancakeSwap, wallet teams, and admins. Check the real official channel before trusting any claim.",
    test: (input) =>
      firstMatch(
        input,
        /(binance|coinbase|pancakeswap|trust\s*wallet|metamask)\s+(official|support|admin|team|giveaway)|official\s+(binance|support|team)|i'?m\s+(an?\s+)?(admin|support|official)/i,
      ),
  },
  {
    id: "urgency",
    label: "Urgency pressure",
    severity: "medium",
    weight: 15,
    explanation:
      "Countdowns and last chance warnings are designed to stop you thinking. Real opportunities do not expire in minutes.",
    test: (input) =>
      firstMatch(
        input,
        /hurry|limited\s*time|ends?\s+(soon|today|tonight|in\s+\d+)|last\s+chance|act\s+now|only\s+\d+\s+(left|spots|remaining)/i,
      ),
  },
  {
    id: "short-link",
    label: "Shortened or masked link",
    severity: "medium",
    weight: 15,
    explanation:
      "Shortened links hide the real destination. Always expand the link and check the domain before opening it.",
    test: (input) =>
      firstMatch(input, /bit\.ly|tinyurl|t\.co|is\.gd|cutt\.ly|shorturl/i),
  },
  {
    id: "giveaway-bait",
    label: "Free money giveaway bait",
    severity: "low",
    weight: 10,
    explanation:
      "Free token giveaways are common in crypto, so this alone proves nothing, but combined with other flags it is a warning sign.",
    test: (input) =>
      firstMatch(
        input,
        /claim\s+(your\s+)?(free|reward|bonus|airdrop)|free\s+(\d[\d,]*\s*)?(usdt|bnb|eth|sol|\$)/i,
      ),
  },
  {
    id: "earn-per-day",
    label: "Earn money per day promise",
    severity: "medium",
    weight: 15,
    explanation:
      "Fixed daily earnings with no work and no risk do not exist. This is the language of mining and investment scams.",
    test: (input) =>
      firstMatch(input, /earn\s+\$?\d+\s*(per|a|every)?\s*day/i),
  },
];

const WEIGHTS: Record<string, number> = Object.fromEntries(
  RULES.map((r) => [r.id, r.weight]),
);

export function localPreCheck(input: string): LocalResult {
  const flags: LocalFlag[] = [];
  for (const rule of RULES) {
    const match = rule.test(input);
    if (match) {
      flags.push({
        id: rule.id,
        label: rule.label,
        severity: rule.severity,
        explanation: rule.explanation,
        match,
      });
    }
  }
  const score = Math.min(
    100,
    flags.reduce((sum, f) => sum + (WEIGHTS[f.id] ?? 0), 0),
  );
  const verdict: Verdict =
    score >= 70 ? "DANGER" : score >= 35 ? "SUSPICIOUS" : "SAFE";
  return { score, verdict, flags };
}

export function recommendedActions(verdict: Verdict): string[] {
  if (verdict === "DANGER") {
    return [
      "Do not interact. Do not connect your wallet, do not send funds, and do not sign anything.",
      "Block and report the sender in the group or platform where you saw it.",
      "If you already connected your wallet, revoke approvals and move your funds to a fresh wallet.",
    ];
  }
  if (verdict === "SUSPICIOUS") {
    return [
      "Do not connect your wallet or send funds until you verify this through the official channel.",
      "Search the project name on its official website or X account and compare the link.",
      "Ask in the official community, never in a DM from a stranger.",
    ];
  }
  return [
    "Looks clean, but stay careful: never share your seed phrase with anyone.",
    "Double-check the link domain before connecting your wallet.",
    "When in doubt, verify through the official website or community first.",
  ];
}

/* ------------------------------------------------------------------ */
/* Input helpers                                                      */
/* ------------------------------------------------------------------ */

export function extractBscAddress(input: string): string | null {
  const m = input.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0] : null;
}

export function extractUrls(input: string): string[] {
  return input.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
}

/* ------------------------------------------------------------------ */
/* Stage 3: read-only on-chain facts (public RPCs + public APIs)      */
/* ------------------------------------------------------------------ */

const RPC_URLS = [
  "https://bsc.publicnode.com",
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc.meowrpc.com",
];

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCall(
  method: string,
  params: unknown[],
): Promise<unknown> {
  let lastError: unknown = null;
  for (const url of RPC_URLS) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        },
        6000,
      );
      const json = (await res.json()) as {
        result?: unknown;
        error?: { message?: string };
      };
      if (json.error) {
        throw new Error(json.error.message ?? "RPC error");
      }
      return json.result;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All BSC RPC endpoints failed");
}

function decodeAbiString(hex: string): string | null {
  if (!hex || hex === "0x" || hex.length < 130) {
    return null;
  }
  const clean = hex.slice(2);
  const len = parseInt(clean.slice(64, 128), 16);
  if (!Number.isFinite(len) || len <= 0 || len > 1000) {
    return null;
  }
  const data = clean.slice(128, 128 + len * 2);
  const bytes = data.match(/.{2}/g);
  if (!bytes) {
    return null;
  }
  try {
    return new TextDecoder().decode(
      new Uint8Array(bytes.map((b) => parseInt(b, 16))),
    );
  } catch {
    return null;
  }
}

async function ethCall(
  address: string,
  calldata: string,
): Promise<string | null> {
  try {
    const result = await rpcCall("eth_call", [
      { to: address, data: calldata },
      "latest",
    ]);
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

async function fetchSourcifyVerified(address: string): Promise<boolean | null> {
  try {
    const res = await fetchWithTimeout(
      `https://sourcify.dev/server/v2/contract/56/${address}`,
      { method: "GET" },
      6000,
    );
    if (res.status === 200) {
      return true;
    }
    if (res.status === 404) {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchDexPairs(address: string): Promise<DexPairInfo[]> {
  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { method: "GET" },
      6000,
    );
    const json = (await res.json()) as {
      pairs?: {
        dexId?: string;
        pairAddress?: string;
        priceUsd?: string;
        liquidity?: { usd?: number };
        txns?: { h24?: { buys?: number; sells?: number } };
      }[];
    };
    const pairs = (json.pairs ?? []).slice(0, 5);
    return pairs.map((p) => ({
      dex: typeof p.dexId === "string" ? p.dexId : "unknown",
      pairAddress: typeof p.pairAddress === "string" ? p.pairAddress : "",
      priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
      liquidityUsd:
        typeof p.liquidity?.usd === "number" ? p.liquidity.usd : null,
      txns24h:
        typeof p.txns?.h24 === "object" && p.txns.h24
          ? (p.txns.h24.buys ?? 0) + (p.txns.h24.sells ?? 0)
          : null,
    }));
  } catch {
    return [];
  }
}

export async function fetchOnChainFacts(
  address: string,
): Promise<OnChainFacts> {
  const errors: string[] = [];
  let isContract: boolean | null = null;
  try {
    const code = await rpcCall("eth_getCode", [address, "latest"]);
    isContract = typeof code === "string" ? code !== "0x" : null;
  } catch {
    errors.push("Could not read contract code from BSC RPC.");
  }

  let name: string | null = null;
  let symbol: string | null = null;
  let decimals: number | null = null;
  let totalSupply: string | null = null;
  if (isContract) {
    const nameHex = await ethCall(address, "0x06fdde03");
    if (nameHex) {
      name = decodeAbiString(nameHex);
    }
    const symbolHex = await ethCall(address, "0x95d89b41");
    if (symbolHex) {
      symbol = decodeAbiString(symbolHex);
    }
    const decimalsHex = await ethCall(address, "0x313ce567");
    if (decimalsHex) {
      const d = parseInt(decimalsHex.slice(-2), 16);
      decimals = Number.isFinite(d) ? d : null;
    }
    const supplyHex = await ethCall(address, "0x18160ddd");
    if (supplyHex && supplyHex !== "0x") {
      try {
        totalSupply = BigInt(supplyHex).toString();
      } catch {
        totalSupply = null;
      }
    }
  }

  const sourcifyVerified = await fetchSourcifyVerified(address);
  if (sourcifyVerified === null) {
    errors.push("Could not reach Sourcify to check source verification.");
  }
  const pairs = await fetchDexPairs(address);

  return {
    address,
    isContract,
    name,
    symbol,
    decimals,
    totalSupply,
    sourcifyVerified,
    pairs,
    errors,
  };
}

export function formatOnChainFactsForPrompt(facts: OnChainFacts): string {
  const lines: string[] = [
    `Contract address: ${facts.address} (BNB Smart Chain)`,
    `Is a smart contract: ${facts.isContract === null ? "unknown" : facts.isContract ? "yes" : "no, this is a plain wallet address"}`,
    `Token name: ${facts.name ?? "unknown"}`,
    `Token symbol: ${facts.symbol ?? "unknown"}`,
    `Decimals: ${facts.decimals ?? "unknown"}`,
    `Total supply: ${facts.totalSupply ?? "unknown"}`,
    `Source code verified on Sourcify: ${facts.sourcifyVerified === null ? "unknown" : facts.sourcifyVerified ? "yes" : "no"}`,
  ];
  if (facts.pairs.length === 0) {
    lines.push(
      "Trading pairs on DexScreener: none. The token has no DEX pair and cannot be sold on a DEX right now.",
    );
  } else {
    lines.push(`Trading pairs on DexScreener: ${facts.pairs.length}`);
    for (const p of facts.pairs) {
      lines.push(
        `- ${p.dex} pair ${p.pairAddress}: price ${p.priceUsd === null ? "unknown" : `$${p.priceUsd}`}, liquidity ${p.liquidityUsd === null ? "unknown" : `$${p.liquidityUsd.toLocaleString()}`}, 24h transactions ${p.txns24h ?? "unknown"}`,
      );
    }
  }
  if (facts.errors.length > 0) {
    lines.push(`Data gaps: ${facts.errors.join(" ")}`);
  }
  return lines.join("\n");
}
