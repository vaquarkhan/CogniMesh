import { useState } from "react";

const STUDIO_URL =
  import.meta.env.VITE_AGENTCORE_STUDIO_URL || "";

export default function AgentCoreStudioView() {
  const [blocked, setBlocked] = useState(false);

  if (!STUDIO_URL) {
    return (
      <div className="agentcore-studio-view">
        <div className="studio-bar">
          <div className="studio-bar-info">
            <strong>AgentCore Studio</strong>
            <span className="studio-bar-sub">Not configured</span>
          </div>
        </div>
        <div className="studio-blocked">
          <h3>AgentCore Studio URL not set</h3>
          <p>
            Set <code>VITE_AGENTCORE_STUDIO_URL</code> at portal build time to embed the
            AgentCore self-service platform here.
          </p>
          <p>
            See{" "}
            <a href="https://github.com/aws-samples/sample-ai-agent-factory" target="_blank" rel="noreferrer">
              aws-samples/sample-ai-agent-factory
            </a>{" "}
            for deployment instructions, or read <code>docs/AGENTCORE_STUDIO_SETUP.md</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="agentcore-studio-view">
      <div className="studio-bar">
        <div className="studio-bar-info">
          <strong>AgentCore Studio</strong>
          <span className="studio-bar-sub">AWS AgentCore self-service platform (embedded)</span>
        </div>
        <a
          href={STUDIO_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          Open in new tab ↗
        </a>
      </div>

      {blocked ? (
        <div className="studio-blocked">
          <h3>Iframe blocked by browser</h3>
          <p>
            The AgentCore Studio uses Cognito authentication which may be blocked
            in embedded mode by your browser's third-party cookie policy.
          </p>
          <p>
            <a href={STUDIO_URL} target="_blank" rel="noreferrer">
              Open AgentCore Studio in a new tab ↗
            </a>
          </p>
          <p className="studio-url">{STUDIO_URL}</p>
        </div>
      ) : (
        <iframe
          className="studio-iframe"
          src={STUDIO_URL}
          title="AgentCore Studio"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          onError={() => setBlocked(true)}
        />
      )}
    </div>
  );
}
