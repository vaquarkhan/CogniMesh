import SparkBars from "./SparkBars";
import PvdmFlowDiagram from "./PvdmFlowDiagram";

function pct(n) {
  if (n == null || Number.isNaN(n)) return "-";
  return `${Math.round(n * 100)}%`;
}

export default function RunObservabilityDashboard({ summary, selectedRun }) {
  if (!summary) return null;

  const vrpPoints = (summary.timeline || []).map((t) => ({
    key: t.ts,
    value: t.vrpVerdict === "PASS" ? 1 : 0,
    color: t.vrpVerdict === "PASS" ? "#059669" : t.vrpVerdict === "FAIL" ? "#dc2626" : "#64748b",
    label: t.ts,
  }));

  const dropPoints = (summary.dropTrend || []).map((t) => ({
    key: t.ts,
    value: Math.round(t.dropPct * 1000) / 10,
    label: `${t.dropped} dropped`,
  }));

  const run = selectedRun || summary.lastRun;

  return (
    <div className="obs-dashboard">
      <div className="obs-cards">
        <div className="obs-card">
          <span className="obs-card-label">VRP pass rate</span>
          <strong className="obs-card-value">{pct(summary.vrpPassRate)}</strong>
          <small>{summary.vrpPass} pass · {summary.vrpFail} fail</small>
        </div>
        <div className="obs-card">
          <span className="obs-card-label">Rows written</span>
          <strong className="obs-card-value">{summary.totalRowsWritten.toLocaleString()}</strong>
          <small className="rows-dropped">{summary.totalRowsDropped.toLocaleString()} dropped (DQ)</small>
        </div>
        <div className="obs-card">
          <span className="obs-card-label">Proof-gated runs</span>
          <strong className="obs-card-value">{summary.proofGatedRuns}</strong>
          <small>of {summary.totalRuns} runs</small>
        </div>
        <div className="obs-card">
          <span className="obs-card-label">AWS deploys</span>
          <strong className="obs-card-value">{summary.aws?.deployedRuns ?? 0}</strong>
          <small>{summary.aws?.lastStatus || "local only"}</small>
        </div>
      </div>

      <div className="obs-charts">
        <div className="obs-chart-block">
          <h3>VRP verdict timeline</h3>
          <p className="properties-hint">Green = PASS · Red = FAIL</p>
          <SparkBars points={vrpPoints} maxVal={1} height={40} />
        </div>
        <div className="obs-chart-block">
          <h3>DQ drop rate trend</h3>
          <p className="properties-hint">SparkRules drop % per run</p>
          <SparkBars points={dropPoints} color="#fbbf24" height={40} />
        </div>
      </div>

      {run && (
        <div className="obs-pvdm-block">
          <h3>PVDM flow {selectedRun ? "(selected run)" : "(latest run)"}</h3>
          <PvdmFlowDiagram verdict={run.vrpVerdict} proofGated={run.proofGated} />
        </div>
      )}
    </div>
  );
}
