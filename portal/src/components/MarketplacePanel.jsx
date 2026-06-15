import { useEffect, useState } from "react";
import { listProducts, requestProductAccess, getProductConsumerDetail } from "../lib/api";

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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const openDetail = async (product) => {
    setSelectedProduct(product);
    setDetailLoading(true);
    try {
      const d = await getProductConsumerDetail({ token, productId: product.id });
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <aside className="marketplace-panel">
      <h2>Marketplace</h2>
      <p className="properties-hint">Discover data products · view schema · request access · query in Athena</p>
      {loading && <p className="properties-hint">Loading products…</p>}
      {error && <p className="login-error" role="alert">{error}</p>}
      {accessMsg && <p className="properties-hint">{accessMsg}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="properties-hint">No data products yet. Deploy a pipeline to register one.</p>
      )}

      {selectedProduct && (
        <div className="product-detail-modal">
          <div className="product-detail-header">
            <h3>{selectedProduct.name}</h3>
            <button type="button" className="canvas-tip-dismiss" onClick={() => { setSelectedProduct(null); setDetail(null); }}>×</button>
          </div>
          {detailLoading && <p className="properties-hint">Loading schema…</p>}
          {detail && (
            <>
              {detail.proofGated && <p className="proof-gated-banner">🛡 Vaquar PVDM proof-gated product</p>}
              <h4>Schema</h4>
              <table className="schema-table">
                <thead><tr><th>Column</th><th>Type</th></tr></thead>
                <tbody>
                  {(detail.schema || []).map((c) => (
                    <tr key={c.name}><td>{c.name}</td><td>{c.type}</td></tr>
                  ))}
                </tbody>
              </table>
              <h4>Sample rows</h4>
              <pre className="sample-rows">{JSON.stringify(detail.sampleRows, null, 2)}</pre>
              {detail.athenaUrl && (
                <a href={detail.athenaUrl} target="_blank" rel="noreferrer" className="athena-link deploy-btn compact">
                  Open in Athena ↗
                </a>
              )}
            </>
          )}
        </div>
      )}

      <ul className="product-list">
        {products.map((p) => {
          const fresh = freshnessLabel(p.registeredAt);
          return (
            <li key={p.id} className="product-card">
              <button type="button" className="product-card-main" onClick={() => openDetail(p)}>
                <div className="product-name">{p.name}</div>
                <div className="product-meta">{p.domain} · v{p.version}</div>
                <div className="product-badges">
                  <span className={`product-status status-${p.status}`}>{p.status}</span>
                  <span className={`freshness-badge ${fresh.className}`}>{fresh.text}</span>
                </div>
              </button>
              <button
                type="button"
                className="btn-secondary product-access-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const { ok, data } = await requestProductAccess({
                      token,
                      productId: p.id,
                      reason: "Consumer access from marketplace",
                      productName: p.name,
                      domain: p.domain,
                    });
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
