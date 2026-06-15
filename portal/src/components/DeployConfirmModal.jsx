export default function DeployConfirmModal({ open, pipelineName, onConfirm, onCancel }) {
  if (!open) return null;

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
        <p className="modal-warning">
          When <code>AWS_DEPLOY_ENABLED=true</code>, this also creates or updates AWS resources
          (Step Functions, Glue jobs).
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="deploy-btn" onClick={onConfirm}>
            Yes, deploy
          </button>
        </div>
      </div>
    </div>
  );
}
