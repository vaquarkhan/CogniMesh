import { useEffect, useState, useRef } from "react";

const BADGE_CLASSES = {
  SUCCEEDED: "dash-badge-success",
  RUNNING: "dash-badge-running",
  FAILED: "dash-badge-fail",
  TIMED_OUT: "dash-badge-fail",
  ABORTED: "dash-badge-fail",
  PREPARED: "dash-badge-success",
  PREPARING: "dash-badge-running",
  NOT_PREPARED: "dash-badge-warn",
};

export default function DashboardView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/public/status");
      const d = await res.json();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 15000);
    return () => clearInterval(timerRef.current);
  }, []);

  const pipelines = data?.pipelines || [];
  const agents = data?.agents || [];
  const succeeded = pipelines.filter((p) => p.lastRun === "SUCCEEDED").length;
  const failed = pipelines.filter((p) => ["FAILED", "TIMED_OUT", "ABORTED"].includes(p.lastRun)).length;
  const running = pipelines.filter((p) => p.lastRun === "RUNNING").length;

  // Donut data
  const total = succeeded + failed + running || 1;
  const donutSegments = [
    { label: "Succeeded", count: succeeded, color: "#059669", pct: succeeded / total },
    { label: "Failed", count: failed, color: "#dc2626", pct: failed / total },
    { label: "Running", count: running, color: "#2563eb", pct: running / total },
  ];

  // Agent status counts
  const agentStatuses = {};
  for (const a of agents) {
    const s = a.status || "UNKNOWN";
    agentStatuses[s] = (agentStatuses[s] || 0) + 1;
  }

  return (
    <div className="dashboard-view">
      <div className="dash-head">
        <div>
          <h2>Platform Dashboard</h2>
          <p className="dash-sub">
            <span className={`dash-dot ${data ? "live" : "connecting"}`} />
            {data ? `Live · ${data.region || "—"}` : "Connecting…"}
            {" · "}
            <a href="/api/v1/public/dashboard" target="_blank" rel="noreferrer" className="dash-public-link">
              Public view ↗
            </a>
          </p>
        </div>
        {error && <span className="dash-error">{error}</span>}
      </div>

      <div className="dash-kpis">
        <div className="dash-kpi"><span className="dash-kpi-label">Pipelines</span><span className="dash-kpi-value accent">{pipelines.length}</span></div>
        <div className="dash-kpi"><span className="dash-kpi-label">Succeeded</span><span className="dash-kpi-value success">{succeeded}</span></div>
        <div className="dash-kpi"><span className="dash-kpi-label">Failed</span><span className="dash-kpi-value fail">{failed}</span></div>
        <div className="dash-kpi"><span className="dash-kpi-label">Agents</span><span className="dash-kpi-value accent">{agents.length}</span></div>
      </div>

      <div className="dash-grid">
        {/* Donut chart */}
        <div className="dash-card">
          <h3>Pipeline Run Status</h3>
          {pipelines.length === 0 ? (
            <p className="dash-empty">No pipelines deployed yet</p>
          ) : (
            <div className="dash-donut-wrap">
              <svg viewBox="0 0 100 100" className="dash-donut-svg">
                {(() => {
                  let offset = 0;
                  return donutSegments.map((seg) => {
                    const dash = seg.pct * 283;
                    const gap = 283 - dash;
                    const el = (
                      <circle
                        key={seg.label}
                        cx="50" cy="50" r="45"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="10"
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 50 50)"
                      />
                    );
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              <div className="dash-legend">
                {donutSegments.filter((s) => s.count > 0).map((s) => (
                  <span key={s.label} className="dash-legend-item">
                    <span className="dash-legend-dot" style={{ background: s.color }} />
                    {s.label}: {s.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agent bar chart */}
        <div className="dash-card">
          <h3>Agents by Status</h3>
          {agents.length === 0 ? (
            <p className="dash-empty">No agents deployed yet</p>
          ) : (
            <div className="dash-bars">
              {Object.entries(agentStatuses).map(([status, count]) => (
                <div key={status} className="dash-bar-row">
                  <span className="dash-bar-label">{status}</span>
                  <div className="dash-bar-track">
                    <div
                      className="dash-bar-fill"
                      style={{ width: `${(count / agents.length) * 100}%`, background: BADGE_CLASSES[status]?.includes("success") ? "#059669" : BADGE_CLASSES[status]?.includes("running") ? "#2563eb" : "#64748b" }}
                    />
                  </div>
                  <span className="dash-bar-count">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline table */}
      <div className="dash-card">
        <h3>All Pipelines</h3>
        {pipelines.length === 0 ? (
          <p className="dash-empty">Deploy a pipeline to see it here</p>
        ) : (
          <table className="dash-table">
            <thead><tr><th>Name</th><th>Created</th><th>Last Run</th></tr></thead>
            <tbody>
              {pipelines.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.created ? new Date(p.created).toLocaleDateString() : "—"}</td>
                  <td><span className={`dash-badge ${BADGE_CLASSES[p.lastRun] || "dash-badge-none"}`}>{p.lastRun || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Agent table */}
      <div className="dash-card">
        <h3>All Agents</h3>
        {agents.length === 0 ? (
          <p className="dash-empty">Deploy an agent to see it here</p>
        ) : (
          <table className="dash-table">
            <thead><tr><th>Name</th><th>ID</th><th>Status</th></tr></thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="dash-mono">{a.id}</td>
                  <td><span className={`dash-badge ${BADGE_CLASSES[a.status] || "dash-badge-none"}`}>{a.status || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
