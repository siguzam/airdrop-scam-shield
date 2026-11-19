import type { HistoryEntry } from "../types";

export default function HistoryPanel({
  entries,
  onSelect,
  onClear,
}: {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section className="card history">
      <div className="history-head">
        <h3>Scan history</h3>
        <button className="btn btn-ghost" type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <ul className="history-list">
        {entries.map((e) => {
          const best = e.deep ?? e.triage;
          const score = best ? best.score : e.local.score;
          const verdict = best ? best.verdict : e.local.verdict;
          return (
            <li key={e.id}>
              <button type="button" onClick={() => onSelect(e)}>
                <span className={`chip chip-${verdict.toLowerCase()}`}>
                  {verdict}
                </span>
                <span className="history-score">{score}/100</span>
                <span className="history-input">
                  {e.input.slice(0, 90)}
                  {e.input.length > 90 ? "…" : ""}
                </span>
                <span className="history-date">
                  {new Date(e.ts).toLocaleString()}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
