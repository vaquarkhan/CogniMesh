import { useEffect, useState } from "react";
import { listProducts, requestProductAccess } from "../lib/api";

function freshnessLabel(registeredAt) {
  if (!registeredAt) return { text: "Unknown", className: "freshness-unknown" };
  const ageMs = Date.now() - new Date(registeredAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 6) return { text: `Fresh (${Math.round(hours)}h ago)`, className: "freshness-ok" };
  if (hours < 24) return { text: `${Math.round(hours)}h ago`, className: "freshness-warn" };
  return { text: `STALE (>${Math.round(hours / 24)}d)`, className: "freshness-stale" };
}

export default function MarketplacePanel({ token, refreshKey }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessMsg, setAccessMsg] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listProducts({ token });
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Marketplace unavailable — is the API running?");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, refreshKey]);

  return (
    <aside className="marketplace-panel">
      <h2>Marketplace</h2>
      {loading && <p className="properties-hint">Loading products…</p>}
      {error && <p className="login-error" role="alert">{error}</p>}
      {accessMsg && <p className="properties-hint">{accessMsg}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="properties-hint">No data products yet. Deploy a pipeline to register one.</p>
      )}
      <ul className="product-list">
        {products.map((p) => {
          const fresh = freshnessLabel(p.registeredAt);
          return (
            <li key={p.id} className="product-card">
              <div className="product-name">{p.name}</div>
              <div className="product-meta">
                {p.domain} · v{p.version}
              </div>
              <div className="product-badges">
                <span className={`product-status status-${p.status}`}>{p.status}</span>
                <span className={`freshness-badge ${fresh.className}`}>{fresh.text}</span>
              </div>
              <button
                type="button"
                className="btn-secondary product-access-btn"
                onClick={async () => {
                  try {
                    const { ok, data } = await requestProductAccess({ token, productId: p.id });
                    setAccessMsg(ok ? `Access requested for ${p.name}` : data.errors?.[0] || "Request failed");
                  } catch (err) {
                    setAccessMsg(err.message);
                  }
                }}
              >
                Request Access
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
