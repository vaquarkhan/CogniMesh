import { useState } from "react";
import LineageGraph from "./LineageGraph";
import VrpProofPanel from "./VrpProofPanel";
import AwsDeployStatusBanner from "./AwsDeployStatusBanner";
import DeployProgress from "./DeployProgress";

const TABS = ["contract", "lineage", "vaquar", "history", "stepfunctions", "deploy"];

function normalizeErrors(error) {
  if (!error) return [];
  const list = Array.isArray(error) ? error : [error];
  return list.map((e) => (typeof e === "string" ? e : e.message || `${e.path}: ${e.message}`));
}

function DeployErrorHero({ title, errors, onOpenFixWizard }) {
  if (!errors.length) return null;
  return (
    <div className="deploy-error-hero" data-testid="deploy-error-hero">
      <h3>{title}</h3>
      <ul className="error-list preview-error-banner">
        {errors.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
      {onOpenFixWizard && (
        <>
          <button type="button" className="deploy-btn" onClick={onOpenFixWizard}>
            Fix in guided wizard
          </button>
          <p className="properties-hint deploy-error-hint">
            We update blocks on the canvas for you - no YAML editing.
          </p>
        </>
      )}
    </div>
  );
}

export default function DeployPanel({
  result,
  loading,
  error,
  token,
  loadingLabel,
  onOpenFixWizard,
}) {
  const [tab, setTab] = useState("contract");
  const errorList = normalizeErrors(error);
  const hasError = errorList.length > 0;

  if (loading && !result) {
    const isDeploying = /deploy/i.test(loadingLabel || "");
    return (
      <aside className="deploy-panel">
        <h2>{loadingLabel || "Working…"}</h2>
        {isDeploying ? (
          <DeployProgress deploying={true} result={null} token={token} />
        ) : (
          <p className="deploy-status loading">{loadingLabel || "Validating → Compiling → Registering"}</p>
        )}
      </aside>
    );
  }

  if (hasError && !result) {
    return (
      <aside className="deploy-panel">
        <h2>Deploy blocked</h2>
        <DeployErrorHero
          title="What went wrong"
          errors={errorList}
          onOpenFixWizard={onOpenFixWizard}
        />
      </aside>
    );
  }

  if (!result) return null;

  const showErrorHero = hasError || result.status !== "success";

  return (
    <aside className="deploy-panel">
      <div className="deploy-header">
        <h2>{result.status === "success" ? "Preview result" : "Preview issues"}</h2>
        <span className={`badge badge-${result.status}`}>{result.status}</span>
      </div>

      {showErrorHero && (
        <DeployErrorHero
          title={hasError ? "Deploy blocked" : "Preview needs attention"}
          errors={
            hasError
              ? errorList
              : ["Preview did not pass all checks - use the fix wizard to resolve issues on the canvas."]
          }
          onOpenFixWizard={onOpenFixWizard}
        />
      )}

      {result.status === "success" && (
        <div className="deploy-summary">
          {result.aws && <DeployProgress deploying={false} result={result} token={token} />}
          <AwsDeployStatusBanner aws={result.aws} token={token} />
          <p>✓ Graph topology validated</p>
          <p>✓ DataContract schema passed</p>
          <p>✓ Integrity gate (Vaquar rules engine)</p>
          {result.contract?.spec?.transform?.pvdm?.qualityPolicyId && (
            <p>✓ Data quality policy: {result.contract.spec.transform.pvdm.qualityPolicyId}</p>
          )}
          {result.pvdmSummary && (
            <>
              <p>
                ✓ VRP verdict:{" "}
                <strong
                  className={
                    result.pvdmSummary.vrpVerdict === "PASS"
                      ? "vrp-pass-text"
                      : result.pvdmSummary.vrpVerdict === "FAIL"
                        ? "vrp-fail-text"
                        : "vrp-unverified-text"
                  }
                >
                  {result.pvdmSummary.vrpVerdict}
                </strong>
              </p>
              <p>✓ Rows: {result.pvdmSummary.rowsWritten} written · {result.pvdmSummary.rowsDropped} dropped (DQ)</p>
              {result.pvdmSummary.proofGated && <p>✓ Proof-gated Iceberg commit</p>}
            </>
          )}
          {result.aws?.executionStatus && (
            <p>✓ AWS Step Functions: <span className={`aws-status aws-${result.aws.executionStatus.status}`}>{result.aws.executionStatus.status}</span>
              {result.aws.executionStatus.consoleUrl && (
                <> · <a href={result.aws.executionStatus.consoleUrl} target="_blank" rel="noreferrer">AWS Console ↗</a></>
              )}
            </p>
          )}
          {result.aws?.stateMachineArn && !result.aws?.executionStatus && (
            <p>○ State machine: <code>{result.aws.stateMachineName || "deployed"}</code></p>
          )}
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
            {t === "contract"
              ? "YAML"
              : t === "lineage"
                ? "Lineage"
                : t === "history"
                  ? "History"
                  : t === "stepfunctions"
                    ? "Step Functions"
                    : t === "vaquar"
                      ? "Vaquar"
                      : "Status"}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === "contract" && <pre>{result.manifestYaml}</pre>}
        {tab === "lineage" && <LineageGraph lineage={result.lineage} height={360} />}
        {tab === "history" && (
          <pre>{JSON.stringify(result.executionHistory || { note: "Deploy to record runs; see Run History panel" }, null, 2)}</pre>
        )}
        {tab === "stepfunctions" && (
          <pre>{JSON.stringify(result.stateMachine, null, 2)}</pre>
        )}
        {tab === "vaquar" && (
          <VrpProofPanel pvdmSummary={result.pvdmSummary} vaquar={result.vaquar} aws={result.aws} />
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
