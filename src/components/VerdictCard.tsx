import type { InferenceSource, Verdict } from "../types";
import HybridBadge from "./HybridBadge";

function verdictWord(v: Verdict): string {
  if (v === "DANGER") {
    return "Danger";
  }
  if (v === "SUSPICIOUS") {
    return "Suspicious";
  }
  return "Looks safe";
}

export default function VerdictCard({
  title,
  score,
  verdict,
  summary,
  source,
}: {
  title: string;
  score: number;
  verdict: Verdict;
  summary: string;
  source?: InferenceSource | null;
}) {
  const cls = verdict.toLowerCase();
  return (
    <section className={`verdict verdict-${cls}`}>
      <div className="verdict-head">
        <div>
          <p className="verdict-kicker">{title}</p>
          <h2 className="verdict-name">{verdictWord(verdict)}</h2>
        </div>
        <div className="score">
          <span className="score-num">{score}</span>
          <span className="score-max">/ 100 risk</span>
        </div>
      </div>
      <div
        className="score-bar"
        role="img"
        aria-label={`Risk score ${score} out of 100`}
      >
        <span style={{ width: `${score}%` }} />
      </div>
      <p className="verdict-summary">{summary}</p>
      {source ? <HybridBadge source={source} /> : null}
    </section>
  );
}
