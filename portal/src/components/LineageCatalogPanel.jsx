import { useEffect, useState } from "react";
import { listLineageCatalog } from "../lib/api";
import LineageGraph from "./LineageGraph";

export default function LineageCatalogPanel({ token, refreshKey }) {
  const [catalog, setCatalog] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listLineageCatalog({ token });
        setCatalog(data);
        if (data?.products?.length && !selected) {
          const first = data.products[0];
          const graph = data.graphs?.find((g) => g.productId === first.productId);
          setSelected(graph || null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, refreshKey]);

  const selectProduct = (productId) => {
    const graph = catalog?.graphs?.find((g) => g.productId === productId);
    setSelected(graph || null);
  };

  return (
    <aside className="lineage-catalog-panel">
      <h2>Lineage Catalog</h2>
      {loading && <p className="properties-hint">Loading lineage…</p>}
      {error && <p className="login-error">{error}</p>}
      {catalog && (
        <p className="properties-hint">
          {catalog.totalProducts} product(s) · domains: {(catalog.domains || []).join(", ") || "-"}
        </p>
      )}
      <ul className="lineage-product-list">
        {(catalog?.products || []).map((p) => (
          <li key={p.productId}>
            <button
              type="button"
              className={`lineage-product-btn ${selected?.productId === p.productId ? "active" : ""}`}
              onClick={() => selectProduct(p.productId)}
            >
              {p.productKey} <small>v{p.version}</small>
            </button>
          </li>
        ))}
      </ul>
      {selected && <LineageGraph lineage={selected} height={320} />}
    </aside>
  );
}
