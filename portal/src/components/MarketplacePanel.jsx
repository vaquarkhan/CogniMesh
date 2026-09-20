import { useEffect, useState } from "react";
import {
  listProducts,
  searchMarketplaceProducts,
  requestProductAccess,
  getProductConsumerDetail,
  verifyVrpProofApi,
  diffVrpProofsApi,
} from "../lib/api";

function freshnessFromSla(product) {
  const sla = product?.trust?.sla;
  if (sla?.label) {
    return {
      text: sla.label,
      className: sla.fresh ? "freshness-ok" : sla.status === "unknown" ? "freshness-unknown" : "freshness-stale",
    };
  }
  if (!product?.registeredAt) return { text: "Unknown", className: "freshness-unknown" };
  const ageMs = Date.now() - new Date(product.registeredAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 6) return { text: `Registered ${Math.round(hours)}h ago`, className: "freshness-ok" };
  if (hours < 24) return { text: `${Math.round(hours)}h since register`, className: "freshness-warn" };
  return { text: `STALE register (>${Math.round(hours / 24)}d)`, className: "freshness-stale" };
}

function parseProofJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Paste a VRP proof JSON object");
  const parsed = JSON.parse(raw);
  return parsed.proof && parsed.verdict ? parsed.proof : parsed;
}

export default function MarketplacePanel({ token, refreshKey }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessMsg, setAccessMsg] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [proofJson, setProofJson] = useState("");
  const [proofJsonB, setProofJsonB] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [proofGatedOnly, setProofGatedOnly] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchMarketplaceProducts({
          token,
          q: query.trim() || undefined,
          proofGated: proofGatedOnly,
          sort: "trust",
          limit: 50,
        });
        setProducts(data.products || []);
        setTotal(data.total || 0);
      } catch (err) {
        try {
          const fallback = await listProducts({ token });
          const list = Array.isArray(fallback) ? fallback : fallback.products || [];
          setProducts(list);
          setTotal(list.length);
        } catch {
          setError(err.message || "Marketplace unavailable - is the API running?");
          setProducts([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    }, query ? 280 : 0);
    return () => clearTimeout(handle);
  }, [token, refreshKey, query, proofGatedOnly]);

  const openDetail = async (product) => {
    setSelectedProduct(product);
    setDetailLoading(true);
    setVerifyResult(null);
    setDiffResult(null);
    try {
      const d = await getProductConsumerDetail({ token, productId: product.id });
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const runVerify = async () => {
    setProofBusy(true);
    setVerifyResult(null);
    try {
      const proof = parseProofJson(proofJson);
      const data = await verifyVrpProofApi({ token, proof, requireSignature: Boolean(proof.signing?.signature) });
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ valid: false, error: err.message });
    } finally {
      setProofBusy(false);
    }
  };

  const runDiff = async () => {
    setProofBusy(true);
    setDiffResult(null);
    try {
      const left = parseProofJson(proofJson);
      const right = parseProofJson(proofJsonB);
      const data = await diffVrpProofsApi({ token, left, right });
      setDiffResult(data);
    } catch (err) {
      setDiffResult({ error: err.message });
    } finally {
      setProofBusy(false);
    }
  };

  return (
    <aside className="marketplace-panel">
      <h2>Marketplace</h2>
      <p className="properties-hint">Discover data products · trust-ranked search · verify proofs · request access</p>
      <div className="marketplace-search-row">
        <input
          type="search"
          className="pattern-search"
          placeholder="Search products (name, domain, badge)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search marketplace products"
        />
        <label className="properties-hint marketplace-filter">
          <input type="checkbox" checked={proofGatedOnly} onChange={(e) => setProofGatedOnly(e.target.checked)} />
          Proof-gated only
        </label>
      </div>
      {!loading && !error && total > 0 && (
        <p className="properties-hint">{total} product{total === 1 ? "" : "s"} · sorted by trust</p>
      )}
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
              {detail.trust && (
                <div className="product-trust-card">
                  <div className="product-trust-header">
                    <span>Trust grade <strong>{detail.trust.grade}</strong></span>
                    <span className="product-trust-score">{detail.trust.score}/100</span>
                  </div>
                  <p className="properties-hint">
                    {detail.conformanceProfile ? `Profile ${detail.conformanceProfile}` : "Conformance pending"}
                    {detail.sourceSnapshotId ? " · source snapshot bound" : ""}
                    {detail.snapshotPin?.snapshot_id ? ` · pin ${detail.snapshotPin.snapshot_id}` : ""}
                  </p>
                  {(detail.sla || detail.trust.sla) && (
                    <p className={`freshness-badge ${(detail.sla || detail.trust.sla).fresh ? "freshness-ok" : "freshness-stale"}`}>
                      {(detail.sla || detail.trust.sla).label}
                    </p>
                  )}
                  {(detail.trust.badges || []).length > 0 && (
                    <div className="product-badges">
                      {detail.trust.badges.map((b) => (
                        <span key={b} className="trust-badge">{b.replace(/_/g, " ")}</span>
                      ))}
                    </div>
                  )}
                  {detail.snapshotPin?.sql && (
                    <pre className="sample-rows">{detail.snapshotPin.sql}</pre>
                  )}
                </div>
              )}
              {detail.access && (
                <p className={`access-status access-${detail.access.status}`}>
                  Access: <strong>{detail.access.status}</strong>
                  {detail.access.status === "approved" && detail.access.lakeFormationGrant && (
                    <span> · Access {detail.access.lakeFormationGrant.permission} ({detail.access.lakeFormationGrant.note})</span>
                  )}
                </p>
              )}
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
              {detail.sampleRowsWithheld ? (
                <p className="properties-hint">{detail.sampleRowsReason}</p>
              ) : (
                <pre className="sample-rows">{JSON.stringify(detail.sampleRows, null, 2)}</pre>
              )}
              {detail.athenaUrl && (
                <a href={detail.athenaUrl} target="_blank" rel="noreferrer" className="athena-link deploy-btn compact">
                  Open in Athena ↗
                </a>
              )}
              <h4>Verify or diff a proof</h4>
              <p className="properties-hint">Paste VRP JSON from Run History. No AWS credentials needed.</p>
              <textarea
                className="proof-paste"
                rows={4}
                placeholder='{"proof_version":"3","verdict":"PASS",...}'
                value={proofJson}
                onChange={(e) => setProofJson(e.target.value)}
              />
              <textarea
                className="proof-paste"
                rows={3}
                placeholder="Optional second proof JSON to diff"
                value={proofJsonB}
                onChange={(e) => setProofJsonB(e.target.value)}
              />
              <div className="product-badges">
                <button type="button" className="deploy-btn compact" disabled={proofBusy} onClick={runVerify}>
                  Verify proof
                </button>
                <button type="button" className="btn-secondary" disabled={proofBusy} onClick={runDiff}>
                  Diff proofs
                </button>
              </div>
              {verifyResult && (
                <p className={verifyResult.valid ? "vrp-pass-text" : "vrp-fail-text"}>
                  {verifyResult.valid ? "Proof VERIFIED" : `Not verified: ${verifyResult.reason || verifyResult.error}`}
                  {verifyResult.verdict ? ` · verdict ${verifyResult.verdict}` : ""}
                </p>
              )}
              {diffResult && (
                <pre className="sample-rows">
                  {diffResult.error
                    ? diffResult.error
                    : diffResult.identical
                      ? "Proofs are identical on integrity fields"
                      : JSON.stringify(diffResult.changes, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}

      <ul className="product-list">
        {products.map((p) => {
          const fresh = freshnessFromSla(p);
          return (
            <li key={p.id} className="product-card">
              <button type="button" className="product-card-main" onClick={() => openDetail(p)}>
                <div className="product-name">{p.name}</div>
                <div className="product-meta">{p.domain} · v{p.version}</div>
                <div className="product-badges">
                  <span className={`product-status status-${p.status}`}>{p.status}</span>
                  {p.trust?.grade && <span className="trust-badge">Trust {p.trust.grade}</span>}
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
                    setAccessMsg(ok ? `Access requested for ${p.name} - pending steward approval` : data.errors?.[0] || "Request failed");
                    if (ok) openDetail(p);
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
