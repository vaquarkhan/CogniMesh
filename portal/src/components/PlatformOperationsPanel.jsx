import { useCallback, useEffect, useState } from "react";
import {
  getLiveDashboard,
  listPipelineVersions,
  rollbackPipelineVersion,
  getHealthScores,
  getCostDashboard,
  getAuditReport,
  getFederatedProducts,
  listPlugins,
  askCopilot,
  getNotificationConfig,
  getOpenSpec,
  getDeployTargets,
  listSlaSubscriptions,
  getColumnLineage,
  diffPipelineVersions,
  downloadAuditMarkdown,
  downloadAuditHtml,
  importFromStateMachine,
  importFromGlueJob,
  getBillingDashboard,
  registerPlugin,
  sandboxPlugin,
  getOpenSpecSiteUrl,
} from "../lib/platform-api";

const TABS = [
  { id: "dashboard", label: "Live ops", tier: 1 },
  { id: "versions", label: "Versions", tier: 1 },
  { id: "health", label: "Health", tier: 2 },
  { id: "cost", label: "Cost", tier: 2 },
  { id: "lineage", label: "Columns", tier: 3 },
  { id: "access", label: "Federated", tier: 2 },
  { id: "billing", label: "Billing", tier: 2 },
  { id: "audit", label: "Audit", tier: 2 },
  { id: "mesh", label: "Multi-cloud", tier: 3 },
  { id: "plugins", label: "Plugins", tier: 4 },
  { id: "copilot", label: "Copilot", tier: 4 },
  { id: "spec", label: "Open spec", tier: 4 },
  { id: "import", label: "Import", tier: 2 },
  { id: "notifications", label: "Alerts", tier: 1 },
];

export default function PlatformOperationsPanel({
  token,
  pipelineMeta,
  nodes,
  edges,
  refreshKey = 0,
  onRollback,
  onImport,
  onClose,
}) {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [versions, setVersions] = useState([]);
  const [health, setHealth] = useState(null);
  const [costs, setCosts] = useState(null);
  const [audit, setAudit] = useState(null);
  const [federated, setFederated] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [targets, setTargets] = useState([]);
  const [sla, setSla] = useState([]);
  const [notif, setNotif] = useState(null);
  const [openSpec, setOpenSpec] = useState(null);
  const [columnLineage, setColumnLineage] = useState(null);
  const [copilotMsg, setCopilotMsg] = useState("");
  const [copilotReply, setCopilotReply] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [diffLeft, setDiffLeft] = useState("");
  const [diffRight, setDiffRight] = useState("");
  const [importArn, setImportArn] = useState("");
  const [importGlueJob, setImportGlueJob] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [billing, setBilling] = useState(null);
  const [pluginForm, setPluginForm] = useState({ id: "", type: "source", label: "", description: "" });
  const [pluginMsg, setPluginMsg] = useState(null);
  const [specSiteUrl, setSpecSiteUrl] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      switch (tab) {
        case "dashboard":
          setDashboard(await getLiveDashboard(token));
          break;
        case "versions":
          if (pipelineMeta?.domain && pipelineMeta?.name) {
            const v = await listPipelineVersions(token, pipelineMeta.domain, pipelineMeta.name);
            setVersions(v?.versions || []);
          }
          break;
        case "health": {
          const h = await getHealthScores(token, pipelineMeta?.domain);
          setHealth(h);
          const slaData = await listSlaSubscriptions(token);
          setSla(slaData?.subscriptions || []);
          break;
        }
        case "cost":
          setCosts(await getCostDashboard(token, pipelineMeta?.domain));
          break;
        case "audit":
          setAudit(await getAuditReport(token, pipelineMeta?.domain));
          break;
        case "access":
          setFederated(await getFederatedProducts(token));
          break;
        case "billing":
          setBilling(await getBillingDashboard(token, { domain: pipelineMeta?.domain }));
          break;
        case "mesh": {
          const t = await getDeployTargets(token);
          setTargets(t?.targets || []);
          break;
        }
        case "plugins": {
          const p = await listPlugins(token);
          setPlugins(p?.plugins || []);
          break;
        }
        case "spec":
          setOpenSpec(await getOpenSpec(token));
          setSpecSiteUrl(await getOpenSpecSiteUrl());
          break;
        case "notifications":
          setNotif(await getNotificationConfig(token));
          break;
        case "lineage":
          if (nodes?.length) {
            setColumnLineage(
              await getColumnLineage(token, { nodes, edges, pipelineMeta })
            );
          }
          break;
        default:
          break;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, token, pipelineMeta, nodes, edges, refreshKey]);

  useEffect(() => {
    load();
    if (tab !== "dashboard") return undefined;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load, tab, refreshKey]);

  const handleRollback = async (versionId) => {
    try {
      const data = await rollbackPipelineVersion(token, versionId);
      if (data?.success && onRollback) onRollback(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCopilot = async () => {
    const data = await askCopilot(token, {
      message: copilotMsg,
      pipelineName: pipelineMeta?.name,
      domain: pipelineMeta?.domain,
    });
    setCopilotReply(data);
  };

  return (
    <aside className="deploy-panel platform-ops-panel">
      <div className="deploy-panel-header">
        <h2>Operations</h2>
        <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="platform-ops-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
            title={`Tier ${t.tier}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="properties-hint">Loading…</p>}
      {error && <p className="deploy-errors">{error}</p>}

      {tab === "dashboard" && dashboard && (
        <div className="platform-ops-body">
          <p className="properties-hint">
            Refreshed {dashboard.refreshedAt} · {dashboard.summary.pipelines} pipelines ·{" "}
            {dashboard.summary.running} running
          </p>
          <ul className="platform-ops-list">
            {dashboard.pipelines.map((p) => (
              <li key={`${p.domain}/${p.pipelineName}`}>
                <strong>{p.pipelineName}</strong> · {p.latestStatus} · {p.latestAt}
                {p.running && <span className="badge-running"> RUNNING</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "versions" && (
        <div className="platform-ops-body">
          <p className="properties-hint">Rollback restores canvas + contract snapshot. Versions persist to data/pipeline-versions.json.</p>
          <ul className="platform-ops-list">
            {versions.map((v) => (
              <li key={v.id}>
                v{v.version} · {v.savedAt}
                <button type="button" className="btn-secondary" onClick={() => handleRollback(v.id)}>
                  Rollback
                </button>
              </li>
            ))}
          </ul>
          {!versions.length && <p className="properties-hint">Deploy once to save versions</p>}
          {versions.length >= 2 && (
            <div className="version-diff-block">
              <h4>Compare versions</h4>
              <select value={diffLeft} onChange={(e) => setDiffLeft(e.target.value)}>
                <option value="">Left version</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>v{v.version} · {v.savedAt}</option>
                ))}
              </select>
              <select value={diffRight} onChange={(e) => setDiffRight(e.target.value)}>
                <option value="">Right version</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>v{v.version} · {v.savedAt}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary"
                disabled={!diffLeft || !diffRight || diffLeft === diffRight}
                onClick={async () => {
                  setDiffResult(await diffPipelineVersions(token, diffLeft, diffRight));
                }}
              >
                Diff
              </button>
              {diffResult?.success && (
                <div className="version-diff-result">
                  <p><strong>{diffResult.diff.summary}</strong> · blast {diffResult.diff.blastRadius}</p>
                  {diffResult.diff.schema.addedColumns.length > 0 && (
                    <p className="properties-hint">Added: {diffResult.diff.schema.addedColumns.join(", ")}</p>
                  )}
                  {diffResult.diff.schema.removedColumns.length > 0 && (
                    <p className="properties-hint">Removed: {diffResult.diff.schema.removedColumns.join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "health" && health?.products && (
        <div className="platform-ops-body">
          <ul className="platform-ops-list">
            {health.products.map((p) => (
              <li key={`${p.domain}/${p.name}`}>
                <strong>{p.name}</strong> — score {p.health.score} ({p.health.grade})
              </li>
            ))}
          </ul>
          {sla.length > 0 && (
            <p className="properties-hint">{sla.length} SLA subscription(s) active</p>
          )}
        </div>
      )}

      {tab === "cost" && costs?.products && (
        <ul className="platform-ops-list">
          {costs.products.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> — ${p.cost.estimatedTotal}/mo
              <span className="properties-hint"> Glue ${p.cost.breakdown.glue}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "lineage" && (
        <div className="platform-ops-body">
          {!nodes?.length && <p className="properties-hint">Add blocks to see column lineage</p>}
          {columnLineage?.columns && (
            <ul className="platform-ops-list">
              {columnLineage.columns.map((c) => (
                <li key={c.column}>
                  <strong>{c.column}</strong> ({c.type})
                  <span className="properties-hint"> ← {c.upstream}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "audit" && audit && (
        <div className="platform-ops-body">
          <p>Pipelines: {audit.summary.pipelines} · Runs: {audit.summary.runs}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              const md = await downloadAuditMarkdown(token, pipelineMeta?.domain);
              const blob = new Blob([md], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `cognimesh-audit-${pipelineMeta?.domain || "all"}-${Date.now()}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download audit report (.md)
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              const html = await downloadAuditHtml(token, pipelineMeta?.domain);
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
            }}
          >
            Open printable HTML (Save as PDF)
          </button>
          <pre className="deploy-yaml agent-yaml">{audit.markdown?.slice(0, 2000)}</pre>
        </div>
      )}

      {tab === "access" && federated && (
        <div className="platform-ops-body">
          <p className="properties-hint">Cross-org mesh marketplace</p>
          <ul className="platform-ops-list">
            {federated.products?.slice(0, 12).map((p) => (
              <li key={p.id}>
                {p.name} · {p.federation?.scope || "local"}
                {p.federation?.orgId && ` · ${p.federation.orgId}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "billing" && billing && (
        <div className="platform-ops-body">
          <p><strong>${billing.totalUsd}</strong> total · cross-org usage</p>
          <ul className="platform-ops-list">
            {billing.organizations.map((o) => (
              <li key={o.orgId}>
                <strong>{o.orgId}</strong> — ${o.totalUsd} · {o.eventCount} events · {o.productCount} products
              </li>
            ))}
          </ul>
          <p className="properties-hint">Query ${billing.rateCard?.query}/query · egress ${billing.rateCard?.egress_gb}/GB</p>
        </div>
      )}

      {tab === "mesh" && (
        <ul className="platform-ops-list">
          {targets.map((t) => (
            <li key={t.id}>
              <strong>{t.label}</strong> — {t.runtime} · {t.status}
            </li>
          ))}
        </ul>
      )}

      {tab === "plugins" && (
        <div className="platform-ops-body">
          <ul className="platform-ops-list">
            {plugins.map((p) => (
              <li key={p.id}>{p.label} ({p.type}) v{p.version}{p.custom && " · custom"}</li>
            ))}
          </ul>
          <div className="plugin-register-form">
            <h4>Register plugin (sandbox)</h4>
            <input placeholder="id" value={pluginForm.id} onChange={(e) => setPluginForm({ ...pluginForm, id: e.target.value })} />
            <input placeholder="label" value={pluginForm.label} onChange={(e) => setPluginForm({ ...pluginForm, label: e.target.value })} />
            <select value={pluginForm.type} onChange={(e) => setPluginForm({ ...pluginForm, type: e.target.value })}>
              <option value="source">source</option>
              <option value="transform">transform</option>
              <option value="sink">sink</option>
            </select>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                const r = await sandboxPlugin(token, pluginForm);
                setPluginMsg(r.success ? `Sandbox OK: ${r.block?.type}` : r.errors?.[0]);
              }}
            >
              Test sandbox
            </button>
            <button
              type="button"
              className="deploy-btn"
              onClick={async () => {
                const r = await registerPlugin(token, pluginForm);
                setPluginMsg(r.success ? `Registered ${r.plugin?.id}` : r.errors?.[0]);
                if (r.success) {
                  const p = await listPlugins(token);
                  setPlugins(p.plugins || []);
                }
              }}
            >
              Register
            </button>
            {pluginMsg && <p className="properties-hint">{pluginMsg}</p>}
          </div>
        </div>
      )}

      {tab === "copilot" && (
        <div className="platform-ops-body">
          <textarea
            className="copilot-input"
            rows={3}
            value={copilotMsg}
            onChange={(e) => setCopilotMsg(e.target.value)}
            placeholder="Why did VRP fail? Show cost breakdown…"
          />
          <button type="button" className="deploy-btn" onClick={handleCopilot}>Ask</button>
          {copilotReply && (
            <div className="copilot-reply">
              <p className="properties-hint">Mode: {copilotReply.mode || "rules"}</p>
              <p>{copilotReply.reply}</p>
              {copilotReply.suggestions?.map((s) => (
                <button key={s} type="button" className="btn-secondary" onClick={() => setCopilotMsg(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "spec" && openSpec && (
        <div className="platform-ops-body">
          <p><strong>{openSpec.spec}</strong> — {openSpec.status}</p>
          <p className="properties-hint">Agent: {openSpec.agentSpec}</p>
          {specSiteUrl && (
            <a href={specSiteUrl} target="_blank" rel="noreferrer">Open specification site ↗</a>
          )}
          <a href={openSpec.publishUrl} target="_blank" rel="noreferrer">GitHub reference</a>
        </div>
      )}

      {tab === "notifications" && notif && (
        <ul className="platform-ops-list">
          <li>Slack: {notif.slack ? "configured" : "not set"}</li>
          <li>Teams: {notif.teams ? "configured" : "not set"}</li>
          <li>PagerDuty: {notif.pagerduty ? "configured" : "not set"}</li>
        </ul>
      )}

      {tab === "import" && (
        <div className="platform-ops-body">
          <p className="properties-hint">Import existing AWS Step Functions or Glue jobs onto the canvas.</p>
          <input
            placeholder="State machine ARN"
            value={importArn}
            onChange={(e) => setImportArn(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!importArn}
            onClick={async () => {
              try {
                const data = await importFromStateMachine(token, {
                  stateMachineArn: importArn,
                  domain: pipelineMeta?.domain,
                  name: pipelineMeta?.name,
                });
                if (!data) {
                  setError("Import API unavailable");
                  return;
                }
                setImportResult(data);
                if (data.success && onImport) onImport(data);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Import SFN
          </button>
          <input
            placeholder="Glue job name"
            value={importGlueJob}
            onChange={(e) => setImportGlueJob(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!importGlueJob}
            onClick={async () => {
              try {
                const data = await importFromGlueJob(token, {
                  jobName: importGlueJob,
                  domain: pipelineMeta?.domain,
                });
                if (!data) {
                  setError("Import API unavailable");
                  return;
                }
                setImportResult(data);
                if (data.success && onImport) onImport(data);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Import Glue job
          </button>
          {importResult && (
            <p className="properties-hint">
              {importResult.message || (importResult.success ? `Loaded ${importResult.nodes?.length} blocks` : importResult.errors?.[0])}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
