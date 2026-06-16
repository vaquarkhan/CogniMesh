import { useEffect, useState } from "react";
import { getPipelineHistory, getPipelineObservability, triggerBackfill, getExecutionStatus } from "../lib/api";
import RunObservabilityDashboard from "./RunObservabilityDashboard";
import PvdmFlowDiagram from "./PvdmFlowDiagram";
import { s3ConsoleUrl } from "../lib/s3-console";
function formatTs(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function VrpBadge({ verdict }) {
  const v = verdict || "UNKNOWN";
  const cls = v === "PASS" ? "vrp-pass" : v === "FAIL" ? "vrp-fail" : "vrp-unknown";
  return <span className={`vrp-badge ${cls}`}>VRP {v}</span>;
}

export default function ExecutionHistoryPanel({ token, pipelineName, domain, refreshKey }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backfillMsg, setBackfillMsg] = useState(null);
  const [expandedRun, setExpandedRun] = useState(null);
  const [awsStatus, setAwsStatus] = useState(null);
  const [obsSummary, setObsSummary] = useState(null);

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
        try {
          const obs = await getPipelineObservability({ token, name: pipelineName, domain });
          setObsSummary(obs);
        } catch {
          setObsSummary(null);
        }
      } catch (err) {
        setError(err.message);
        setRuns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, pipelineName, domain, refreshKey]);

  useEffect(() => {
    const latest = runs.find((r) => r.awsExecutionArn);
    if (!latest?.awsExecutionArn) return;
    loadAwsStatus(latest.awsExecutionArn);
    const id = setInterval(() => loadAwsStatus(latest.awsExecutionArn), 5000);
    return () => clearInterval(id);
  }, [runs, token]);

  const loadAwsStatus = async (arn) => {
    if (!arn) return;
    try {
      const s = await getExecutionStatus({ token, executionArn: arn });
      setAwsStatus(s);
    } catch {
      setAwsStatus(null);
    }
  };

  if (!pipelineName) {
    return (
      <aside className="execution-history-panel">
        <h2>Run observability</h2>
        <p className="properties-hint">Deploy a pipeline to see VRP proof and execution history.</p>
      </aside>
    );
  }

  return (
    <aside className="execution-history-panel">
      <h2>Run observability</h2>
      <p className="properties-hint">
        {pipelineName}
        {domain ? ` · ${domain}` : ""} - VRP proof · rows · AWS status
      </p>
      {loading && <p className="properties-hint">Loading runs…</p>}
      {error && <p className="login-error">{error}</p>}
      {backfillMsg && <p className="properties-hint">{backfillMsg}</p>}

      <RunObservabilityDashboard
        summary={obsSummary}
        selectedRun={runs.find((r) => r.id === expandedRun) || null}
      />

      <div className="backfill-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            const startDate = prompt("Backfill start date (YYYY-MM-DD)", "2026-01-01");
            if (!startDate) return;
            const endDate = prompt("Backfill end date (YYYY-MM-DD)", "2026-01-31");
            if (!endDate) return;
            try {
              const { ok, data } = await triggerBackfill({ token, pipelineName, domain, startDate, endDate });
              setBackfillMsg(ok ? "Backfill queued" : data.errors?.[0] || "Backfill failed");
            } catch (err) {
              setBackfillMsg(err.message);
            }
          }}
        >
          Trigger backfill
        </button>
      </div>

      {!loading && !error && runs.length === 0 && (
        <p className="properties-hint">No runs recorded yet.</p>
      )}

      <ul className="execution-run-list">
        {runs.map((r) => {
          const open = expandedRun === r.id;
          return (
            <li key={r.id} className={`execution-run outcome-${r.outcome} ${open ? "expanded" : ""}`}>
              <button type="button" className="execution-run-header-btn" onClick={() => setExpandedRun(open ? null : r.id)}>
                <div className="execution-run-header">
                  <span className="execution-outcome">{r.outcome}</span>
                  <VrpBadge verdict={r.vrpVerdict} />
                  <span className="execution-ts">{formatTs(r.ts)}</span>
                </div>
                <div className="execution-run-meta">
                  v{r.version}
                  {r.proofGated && <span className="proof-gated-tag">🛡 Proof-gated</span>}
                  {r.rowsProcessed != null && (
                    <span> · {r.rowsWritten ?? r.rowsProcessed} rows written</span>
                  )}
                  {r.rowsDropped > 0 && <span className="rows-dropped"> · {r.rowsDropped} dropped (DQ)</span>}
                </div>
              </button>

              {open && (
                <div className="execution-run-detail">
                  <PvdmFlowDiagram verdict={r.vrpVerdict} proofGated={r.proofGated} compact />
                  {r.message && <p className="run-message">{r.message}</p>}
                  <dl className="proof-dl">
                    <dt>Quality policy</dt>
                    <dd>{r.qualityPolicyId || "-"}</dd>
                    <dt>Rows processed</dt>
                    <dd>{r.rowsProcessed ?? "-"}</dd>
                    <dt>Rows dropped (SparkRules)</dt>
                    <dd>{r.rowsDropped ?? 0}</dd>
                    <dt>Iceberg snapshot</dt>
                    <dd><code>{r.icebergSnapshotId || "-"}</code></dd>
                    <dt>Proof artifact</dt>
                    <dd>
                      {r.proofS3Uri ? (
                        <>
                          <code className="proof-link">{r.proofS3Uri}</code>
                          {s3ConsoleUrl(r.proofS3Uri) && (
                            <a href={s3ConsoleUrl(r.proofS3Uri)} target="_blank" rel="noreferrer" className="aws-console-link">
                              Open proof in S3 ↗
                            </a>
                          )}
                        </>
                      ) : "-"}
                    </dd>
                    <dt>Checkpoint</dt>
                    <dd>
                      {r.checkpointS3Uri ? (
                        <>
                          <code className="proof-link">{r.checkpointS3Uri}</code>
                          {s3ConsoleUrl(r.checkpointS3Uri) && (
                            <a href={s3ConsoleUrl(r.checkpointS3Uri)} target="_blank" rel="noreferrer" className="aws-console-link">
                              Open checkpoint in S3 ↗
                            </a>
                          )}
                        </>
                      ) : "-"}
                    </dd>
                    <dt>AWS execution</dt>
                    <dd>
                      {r.awsExecutionArn ? (
                        <>
                          <span className={`aws-status aws-${r.awsStatus || "unknown"}`}>{r.awsStatus || "unknown"}</span>
                          <button
                            type="button"
                            className="btn-secondary compact"
                            onClick={() => loadAwsStatus(r.awsExecutionArn)}
                          >
                            Refresh AWS status
                          </button>
                          {awsStatus?.consoleUrl && (
                            <a href={awsStatus.consoleUrl} target="_blank" rel="noreferrer" className="aws-console-link">
                              Open in AWS Console ↗
                            </a>
                          )}
                        </>
                      ) : (
                        "Local / not deployed to AWS"
                      )}
                    </dd>
                  </dl>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
