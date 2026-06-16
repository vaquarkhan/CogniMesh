import { downloadAgentManifest } from "../lib/agent-export";

export default function AgentPreviewPanel({ result, loading, error, onClose }) {
  if (!result && !loading && !error) return null;

  return (
    <aside className="deploy-panel agent-preview-panel">
      <div className="deploy-panel-header">
        <h2>AgentCore manifest</h2>
        <div className="deploy-panel-actions">
          {result?.yaml && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => downloadAgentManifest(result.yaml, result.manifest?.metadata?.name)}
            >
              Download YAML
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      {loading && <p className="properties-hint">Generating manifest…</p>}

      {error?.length > 0 && (
        <ul className="deploy-errors">
          {error.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {result?.yaml && (
        <>
          <p className="properties-hint">
            AgentCore deployment spec for <strong>{result.manifest?.metadata?.name}</strong>
            {result.manifest?.spec?.guardrails?.length > 0 && (
              <> · Guardrails: {result.manifest.spec.guardrails.map((g) => g.id).join(", ")}</>
            )}
          </p>
          <p className="properties-hint agent-manifest-boundary">
            Design-time export only - CogniMesh does not provision Bedrock agents yet. Pipeline <strong>Deploy</strong> is wired to Step Functions; agent AWS deploy is the next integration (IAM role, KB, Lambda action groups, guardrails).
          </p>
          <pre className="deploy-yaml agent-yaml">{result.yaml}</pre>
        </>
      )}
    </aside>
  );
}
