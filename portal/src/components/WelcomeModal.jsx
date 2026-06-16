import { PIPELINE_PATTERNS, instantiatePattern } from "../lib/pipeline-patterns";

export default function WelcomeModal({ open, onClose, onApplyPattern }) {
  if (!open) return null;

  const recommended = PIPELINE_PATTERNS.find((p) => p.id === "multi-source-mesh");

  const dismiss = () => {
    try {
      localStorage.setItem("cognimesh_welcome_seen", "1");
    } catch {
      /* ignore */
    }
    onClose();
  };

  return (
    <div className="modal-backdrop welcome-backdrop" role="presentation">
      <div className="modal-dialog welcome-dialog" role="dialog" aria-labelledby="welcome-title">
        <h2 id="welcome-title">Welcome to CogniMesh</h2>
        <p className="welcome-lead">
          Build Step Functions–style workflows visually - many sources, parallel branches, choice routes, multiple sinks.
        </p>

        <ol className="welcome-steps">
          <li>
            <strong>Pick a pattern</strong> - multi-source mesh, RDS CDC, AI media, and more in the left library.
          </li>
          <li>
            <strong>Drag flow blocks</strong> - Parallel, Choice, Merge from the Blocks tab (like AWS Step Functions).
          </li>
          <li>
            <strong>Preview YAML</strong> - see the generated contract before deploy.
          </li>
          <li>
            <strong>Deploy</strong> - register in the marketplace (and AWS when enabled).
          </li>
        </ol>

        <div className="welcome-actions">
          <button
            type="button"
            className="deploy-btn"
            onClick={() => {
              onApplyPattern(instantiatePattern(recommended));
              dismiss();
            }}
          >
            Start with: Multi-Source workflow (Parallel → Choice)
          </button>
          <button type="button" className="btn-secondary" onClick={dismiss}>
            Browse all patterns
          </button>
        </div>
      </div>
    </div>
  );
}
