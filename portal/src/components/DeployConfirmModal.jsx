export default function DeployConfirmModal({
  open,
  pipelineName,
  awsReview,
  awsDeployCheck,
  impact,
  impactLoading,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const blocked = awsReview?.overall?.deployBlocked || impact?.deployBlocked;
  const critical = awsReview?.overall?.criticalCount || 0;
  const awsMisconfigured = awsDeployCheck?.enabled && !awsDeployCheck?.roleConfigured;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-labelledby="deploy-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="deploy-confirm-title">Deploy pipeline?</h2>
        <p>
          This will compile <strong>{pipelineName || "your pipeline"}</strong>, run the integrity gate,
          and register a data product in the marketplace.
        </p>

        {awsDeployCheck && (
          <div className={`deploy-aws-readiness ${awsMisconfigured ? "deploy-aws-readiness-warn" : ""}`}>
            <p>
              <strong>AWS Step Functions:</strong>{" "}
              {awsDeployCheck.enabled
                ? awsDeployCheck.roleConfigured
                  ? "enabled — state machine will be created or updated"
                  : "misconfigured on API server"
                : "local compile only (AWS deploy off)"}
            </p>
            <p className="properties-hint">
              {awsDeployCheck.message}
              {awsDeployCheck.hint && (
                <>
                  {" "}
                  <code>{awsDeployCheck.hint}</code>
                </>
              )}
            </p>
          </div>
        )}

        {awsReview && (
          <div className="deploy-review-summary">
            <p>
              AWS Design Review: <strong>{awsReview.overall?.score}/100</strong> -{" "}
              {awsReview.overall?.grade?.label}
            </p>
            <p className="properties-hint">
              Security {awsReview.security?.score} · Architecture {awsReview.architecture?.score}
              {critical > 0 && <span className="aws-critical-banner"> · {critical} critical</span>}
            </p>
          </div>
        )}

        {impactLoading && <p className="properties-hint">Analyzing deploy impact…</p>}

        {impact && !impactLoading && (
          <div className="deploy-impact-summary">
            <p>
              Impact analysis: <strong>{impact.blastRadius}</strong> blast radius
            </p>
            <p className="properties-hint">{impact.recommendation}</p>
            {impact.affectedConsumers?.length > 0 && (
              <ul className="impact-consumer-list">
                {impact.affectedConsumers.slice(0, 4).map((c) => (
                  <li key={c.consumerId}>
                    {c.consumerId} ({c.risk}) — {c.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {blocked && (
          <p className="modal-warning modal-error">
            Deploy is blocked until critical AWS issues or strict-schema impact review is resolved.
          </p>
        )}

        {!awsDeployCheck?.enabled && (
          <p className="modal-warning">
            Without <code>AWS_DEPLOY_ENABLED=true</code> and <code>AWS_STEP_FUNCTIONS_ROLE_ARN</code> on the API
            server, deploy compiles locally and does not create a Step Functions state machine in AWS.
          </p>
        )}

        {awsMisconfigured && (
          <p className="modal-warning modal-error">
            AWS deploy is enabled but <code>AWS_STEP_FUNCTIONS_ROLE_ARN</code> is missing. Set it from{" "}
            <code>terraform output pipeline_orchestrator_role_arn</code> (dev) before expecting SFN in AWS.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="deploy-btn" onClick={onConfirm} disabled={blocked || impactLoading}>
            {blocked ? "Fix issues first" : "Yes, deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}
