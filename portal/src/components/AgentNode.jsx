import { memo } from "react";
import { Handle, Position } from "reactflow";

const STYLES = {
  runtime: { bg: "#4338ca", border: "#6366f1", icon: "⚡" },
  supervisor: { bg: "#6d28d9", border: "#a78bfa", icon: "🧩" },
  foundation_model: { bg: "#1d4ed8", border: "#3b82f6", icon: "🤖" },
  gateway: { bg: "#0e7490", border: "#06b6d4", icon: "🌐" },
  tool_lambda: { bg: "#854d0e", border: "#ca8a04", icon: "λ" },
  tool_mcp: { bg: "#047857", border: "#10b981", icon: "🔌" },
  tool_api: { bg: "#0369a1", border: "#0284c7", icon: "📡" },
  code_interpreter: { bg: "#7c3aed", border: "#8b5cf6", icon: "💻" },
  browser: { bg: "#0d9488", border: "#14b8a6", icon: "🌍" },
  knowledge_base: { bg: "#b45309", border: "#f59e0b", icon: "📚" },
  memory_session: { bg: "#be185d", border: "#ec4899", icon: "🧠" },
  memory_long: { bg: "#9d174d", border: "#db2777", icon: "🗄" },
  guardrail: { bg: "#991b1b", border: "#f87171", icon: "🛡" },
  identity: { bg: "#4c1d95", border: "#7c3aed", icon: "🪪" },
  observability: { bg: "#334155", border: "#64748b", icon: "📊" },
  human_loop: { bg: "#c2410c", border: "#fb923c", icon: "👤" },
};

function AgentNode({ data, selected }) {
  const style = STYLES[data.blockType] || { bg: "#374151", border: "#6b7280", icon: "◆" };
  const isRuntime = data.blockType === "runtime" || data.blockType === "supervisor";

  return (
    <div
      className={`agent-node ${selected ? "selected" : ""} ${data.validationError ? "invalid" : ""}`}
      style={{ background: style.bg, borderColor: style.border }}
    >
      {!isRuntime && <Handle type="target" position={Position.Left} className="agent-handle" />}
      <div className="agent-node-icon">{style.icon}</div>
      <div className="agent-node-body">
        <div className="agent-node-label">{data.label}</div>
        <div className="agent-node-detail">{data.detail || data.blockType}</div>
        {data.validationError && <div className="agent-node-error">{data.validationError}</div>}
      </div>
      <Handle type="source" position={Position.Right} className="agent-handle" />
    </div>
  );
}

export default memo(AgentNode);
