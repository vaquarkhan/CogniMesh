import { useEffect, useState } from "react";
import { getPipelineHistory } from "../lib/api";

function formatTs(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function ExecutionHistoryPanel({ token, pipelineName, domain, refreshKey }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pipelineName) {
      setRuns([]);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPipelineHistory({ token, name: pipelineName, domain });
        setRuns(data.runs || []);
      } catch (err) {
        setError(err.message);
        setRuns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, pipelineName, domain, refreshKey]);

  if (!pipelineName) {
    return (
      <aside className="execution-history-panel">
        <h2>Execution history</h2>
        <p className="properties-hint">Deploy a pipeline to see run history.</p>
      </aside>
    );
  }

  return (
    <aside className="execution-history-panel">
      <h2>Execution history</h2>
      <p className="properties-hint">
        {pipelineName}
        {domain ? ` · ${domain}` : ""}
      </p>
      {loading && <p className="properties-hint">Loading runs…</p>}
      {error && <p className="login-error">{error}</p>}
      {!loading && !error && runs.length === 0 && (
        <p className="properties-hint">No runs recorded yet.</p>
      )}
      <ul className="execution-run-list">
        {runs.map((r) => (
          <li key={r.id} className={`execution-run outcome-${r.outcome}`}>
            <div className="execution-run-header">
              <span className="execution-outcome">{r.outcome}</span>
              <span className="execution-ts">{formatTs(r.ts)}</span>
            </div>
            <div className="execution-run-meta">
              v{r.version}
              {r.catalogRegistered != null && (
                <span> · catalog {r.catalogRegistered ? "yes" : "no"}</span>
              )}
              {r.vrpPattern && <span> · {r.vrpPattern}</span>}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
