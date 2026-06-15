import { useEffect, useState } from "react";
import { listProducts } from "../lib/api";

export default function MarketplacePanel({ token, refreshKey }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listProducts({ token });
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, refreshKey]);

  return (
    <aside className="marketplace-panel">
      <h2>Marketplace</h2>
      {loading && <p className="properties-hint">Loading products…</p>}
      {error && <p className="login-error">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="properties-hint">No data products yet. Deploy a pipeline to register one.</p>
      )}
      <ul className="product-list">
        {products.map((p) => (
          <li key={p.id} className="product-card">
            <div className="product-name">{p.name}</div>
            <div className="product-meta">
              {p.domain} · v{p.version}
            </div>
            <span className={`product-status status-${p.status}`}>{p.status}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
