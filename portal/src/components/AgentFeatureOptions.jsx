import { AGENT_FEATURES } from "../lib/agent-feature-options";

export default function AgentFeatureOptions({ features, onChange, compact = false }) {
  const toggle = (id, checked) => {
    onChange({ ...features, [id]: checked });
  };

  return (
    <div className={`agent-feature-options${compact ? " compact" : ""}`}>
      <p className="properties-hint">
        <strong>Agent features</strong>
        {!compact && " - choose what to include when the agent is created"}
      </p>
      <div className="agent-feature-grid">
        {AGENT_FEATURES.map((feat) => (
          <label key={feat.id} className="agent-feature-check" title={feat.description}>
            <input
              type="checkbox"
              checked={features[feat.id] !== false}
              onChange={(e) => toggle(feat.id, e.target.checked)}
            />
            <span className="agent-feature-label">{feat.label}</span>
            {!compact && <span className="agent-feature-desc">{feat.description}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
