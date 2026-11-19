import type { OnChainFacts } from "../types";

function yesNo(v: boolean | null): string {
  if (v === null) {
    return "Unknown";
  }
  return v ? "Yes" : "No";
}

export default function OnChainCard({
  facts,
  loading,
}: {
  facts: OnChainFacts | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="card">
        <h3>On-chain facts</h3>
        <p className="muted">
          Reading the contract from public BSC sources…
        </p>
      </section>
    );
  }
  if (!facts) {
    return null;
  }
  return (
    <section className="card">
      <h3>On-chain facts · BNB Smart Chain</h3>
      <dl className="facts">
        <div>
          <dt>Address</dt>
          <dd className="mono">{facts.address}</dd>
        </div>
        <div>
          <dt>Smart contract</dt>
          <dd>{yesNo(facts.isContract)}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>
            {facts.name ?? "Unknown"}
            {facts.symbol ? ` (${facts.symbol})` : ""}
          </dd>
        </div>
        <div>
          <dt>Total supply</dt>
          <dd>{facts.totalSupply ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Source verified (Sourcify)</dt>
          <dd>{yesNo(facts.sourcifyVerified)}</dd>
        </div>
      </dl>
      {facts.pairs.length === 0 ? (
        <p className="muted">
          No trading pair found on DexScreener. This token cannot be sold on
          a DEX right now.
        </p>
      ) : (
        <ul className="pairs">
          {facts.pairs.map((p) => (
            <li key={p.pairAddress}>
              <strong>{p.dex}</strong>
              <span>
                {p.priceUsd === null ? "price unknown" : `$${p.priceUsd}`}
              </span>
              <span>
                {p.liquidityUsd === null
                  ? "liquidity unknown"
                  : `liquidity $${p.liquidityUsd.toLocaleString()}`}
              </span>
              <span>
                {p.txns24h === null ? "" : `${p.txns24h} txns / 24h`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {facts.errors.length > 0 ? (
        <p className="muted">{facts.errors.join(" ")}</p>
      ) : null}
    </section>
  );
}
