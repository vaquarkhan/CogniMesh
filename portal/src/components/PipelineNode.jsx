import { memo } from "react";
import { Handle, Position } from "reactflow";

const COLORS = {
  source: { bg: "#059669", border: "#047857" },
  transform: { bg: "#2563eb", border: "#1d4ed8" },
  sink: { bg: "#ea580c", border: "#c2410c" },
};

function PipelineNode({ data, selected }) {
  const colors = COLORS[data.blockType] || COLORS.transform;
  const invalid = Boolean(data.validationError);

  return (
    <div
      className={`pipeline-node ${selected ? "selected" : ""} ${invalid ? "invalid" : ""}`}
      style={{
        borderColor: invalid ? "#dc2626" : colors.border,
        background: invalid ? "#7f1d1d" : colors.bg,
      }}
      title={data.validationError || undefined}
    >
      {data.blockType !== "source" && (
        <Handle type="target" position={Position.Left} className="handle" />
      )}

      <div className="node-type">{data.blockType}</div>
      <div className="node-label">{data.label}</div>
      <div className="node-detail">{data.validationError || data.detail}</div>

      {data.blockType !== "sink" && (
        <Handle type="source" position={Position.Right} className="handle" />
      )}
    </div>
  );
}

export default memo(PipelineNode);
