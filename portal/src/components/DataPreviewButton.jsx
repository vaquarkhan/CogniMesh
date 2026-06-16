import { useState } from "react";
import { previewSourceData } from "../lib/platform-api";

function previewModeLabel(preview) {
  if (preview.live) return "Live data";
  if (preview.simulated) return "Simulated";
  if (preview.fallback) return "Live failed — showing sample";
  return "Sample data";
}

function previewModeClass(preview) {
  if (preview.live) return "data-preview-badge data-preview-badge-live";
  if (preview.fallback) return "data-preview-badge data-preview-badge-warn";
  return "data-preview-badge data-preview-badge-sim";
}

export default function DataPreviewButton({ token, nodes, edges, pipelineMeta }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await previewSourceData(token, { nodes, edges, pipelineMeta, limit: 10 });
      setPreview(data);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const display = preview?.fallback || preview;

  return (
    <div className="data-preview-block">
      <button type="button" className="btn-secondary" onClick={handlePreview} disabled={loading || !nodes?.length}>
        {loading ? "Sampling…" : "Preview source data (10 rows)"}
      </button>
      <p className="properties-hint data-preview-hint">
        Server flag <code>DATA_PREVIEW_LIVE=true</code> enables S3, local file, JDBC, and Athena sampling.
      </p>
      {error && <p className="deploy-errors">{error}</p>}
      {display && (
        <div className="data-preview-result">
          <p className="properties-hint data-preview-meta">
            <span className={previewModeClass(display)}>{previewModeLabel(display)}</span>
            <span>
              {display.sourceType} · {display.rowCount} rows
            </span>
          </p>
          {display.note && <p className="properties-hint">{display.note}</p>}
          {preview?.fallback && preview.error && (
            <p className="deploy-errors">{preview.error}</p>
          )}
          <table className="data-preview-table">
            <thead>
              <tr>
                {display.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.rows.map((row, i) => (
                <tr key={i}>
                  {display.columns.map((c) => (
                    <td key={c}>{String(row[c] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
