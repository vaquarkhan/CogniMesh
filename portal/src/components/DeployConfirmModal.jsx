export default function DeployConfirmModal({
  open,
  pipelineName,
  awsReview,
  impact,
  impactLoading,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const blocked = awsReview?.overall?.deployBlocked || impact?.deployBlocked;
  const critical = awsReview?.overall?.criticalCount || 0;

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

        <p className="modal-warning">
          When <code>AWS_DEPLOY_ENABLED=true</code>, this also creates or updates AWS resources
          (Step Functions, Glue jobs).
        </p>
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
