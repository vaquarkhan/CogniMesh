import { useState } from "react";

const TABS = ["contract", "stepfunctions", "vaquar", "deploy"];

export default function DeployPanel({ result, loading, error }) {
  const [tab, setTab] = useState("contract");

  if (loading) {
    return (
      <aside className="deploy-panel">
        <h2>Deploying…</h2>
        <p className="deploy-status loading">Validating → Compiling → Registering</p>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="deploy-panel">
        <h2>Deploy failed</h2>
        <ul className="error-list">
          {(Array.isArray(error) ? error : [error]).map((e, i) => (
            <li key={i}>{typeof e === "string" ? e : `${e.path}: ${e.message}`}</li>
          ))}
        </ul>
      </aside>
    );
  }

  if (!result) return null;

  return (
    <aside className="deploy-panel">
      <div className="deploy-header">
        <h2>Deploy result</h2>
        <span className={`badge badge-${result.status}`}>{result.status}</span>
      </div>

      {result.status === "success" && (
        <div className="deploy-summary">
          <p>✓ Graph topology validated</p>
          <p>✓ DataContract schema passed</p>
          <p>✓ Integrity gate (Vaquar rules engine)</p>
          <p>✓ Step Functions compiled{result.vaquar?.pattern ? ` (${result.vaquar.pattern})` : ""}</p>
          {result.vaquar?.outputDir && (
            <p>✓ Vaquar mesh artifacts → <code>{result.vaquar.outputDir}</code></p>
          )}
          {result.vaquar?.phases?.length > 0 && (
            <p className="deploy-vaquar-phases">PVDM: {result.vaquar.phases.join(" → ")}</p>
          )}
          <p>{result.catalog?.registered ? "✓ Registered in marketplace" : "○ Catalog offline (pipeline still compiled)"}</p>
          <p>{result.aws?.deployed ? "✓ AWS Step Functions deployed" : `○ AWS: ${result.aws?.reason || result.aws?.error || "local only"}`}</p>
          {result.integrityGate?.warnings?.length > 0 && (
            <p className="warn-text">⚠ {result.integrityGate.warnings.length} warning(s)</p>
          )}
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "contract" ? "YAML" : t === "stepfunctions" ? "Step Functions" : t === "vaquar" ? "Vaquar" : "Status"}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === "contract" && <pre>{result.manifestYaml}</pre>}
        {tab === "stepfunctions" && (
          <pre>{JSON.stringify(result.stateMachine, null, 2)}</pre>
        )}
        {tab === "vaquar" && (
          <pre>{JSON.stringify(
            {
              pattern: result.vaquar?.pattern,
              outputDir: result.vaquar?.outputDir,
              phases: result.vaquar?.phases,
              mesh: result.vaquar?.mesh,
              meshYaml: result.vaquar?.meshYaml,
            },
            null,
            2
          )}</pre>
        )}
        {tab === "deploy" && (
          <pre>{JSON.stringify(
            {
              integrityGate: result.integrityGate,
              catalog: result.catalog,
              pipeline: result.contract?.metadata,
            },
            null,
            2
          )}</pre>
        )}
      </div>
    </aside>
  );
}
