import { useState } from "react";
import AiPipelineBuilder from "./AiPipelineBuilder";
import AiAgentBuilder from "./AiAgentBuilder";

export default function AiBuilderHub({ onApplyPattern, onLaunchAgent }) {
  const [mode, setMode] = useState("pipeline");

  return (
    <div className="ai-builder-hub">
      <div className="ai-builder-mode-tabs">
        <button
          type="button"
          className={mode === "pipeline" ? "active" : ""}
          onClick={() => setMode("pipeline")}
        >
          Data pipeline
        </button>
        <button
          type="button"
          className={mode === "agent" ? "active agent-tab-active" : ""}
          onClick={() => setMode("agent")}
        >
          AI agent
        </button>
      </div>

      {mode === "pipeline" ? (
        <AiPipelineBuilder onApplyPattern={onApplyPattern} />
      ) : (
        <AiAgentBuilder onLaunchAgent={onLaunchAgent} />
      )}
    </div>
  );
}
