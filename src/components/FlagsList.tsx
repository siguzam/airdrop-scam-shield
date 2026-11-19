export interface DisplayFlag {
  label: string;
  explanation: string;
  tag: string;
}

export default function FlagsList({
  title,
  flags,
  emptyText,
}: {
  title: string;
  flags: DisplayFlag[];
  emptyText: string;
}) {
  return (
    <section className="card flags-card">
      <h3>{title}</h3>
      {flags.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <ul className="flags">
          {flags.map((f) => (
            <li key={f.label}>
              <span className="flag-tag">{f.tag}</span>
              <div>
                <strong>{f.label}</strong>
                <p>{f.explanation}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
