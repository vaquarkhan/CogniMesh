import { memo } from "react";
import { Handle, Position } from "reactflow";

const STYLES = {
  start: { bg: "#065f46", border: "#10b981", shape: "circle", icon: "▶" },
  parallel: { bg: "#c2410c", border: "#fb923c", shape: "diamond", icon: "⫸" },
  merge: { bg: "#c2410c", border: "#fdba74", shape: "rounded", icon: "⫷" },
  choice: { bg: "#0e7490", border: "#22d3ee", shape: "diamond", icon: "?" },
  map: { bg: "#6d28d9", border: "#a78bfa", shape: "rounded", icon: "↻" },
  pass: { bg: "#475569", border: "#94a3b8", shape: "rounded", icon: "→" },
  integrity_gate: { bg: "#991b1b", border: "#f87171", shape: "shield", icon: "🛡" },
  source: { bg: "#059669", border: "#047857", shape: "rect", icon: "⬇" },
  transform: { bg: "#2563eb", border: "#1d4ed8", shape: "rect", icon: "⚙" },
  sink: { bg: "#ea580c", border: "#c2410c", shape: "rect", icon: "⬆" },
};

const NO_TARGET = new Set(["start"]);
const NO_SOURCE = new Set(["sink"]);
const MULTI_SOURCE = new Set(["parallel", "choice"]);

function PipelineNode({ data, selected }) {
  const bt = data.blockType || "pass";
  const style = STYLES[bt] || STYLES.pass;
  const invalid = Boolean(data.validationError);
  const awsIssues = data.awsReviewCount || 0;
  const awsSev = data.awsReviewSeverity;
  const shapeClass = `node-shape-${style.shape}`;

  let borderColor = style.border;
  let bgColor = style.bg;
  if (invalid) {
    borderColor = "#dc2626";
    bgColor = "#7f1d1d";
  } else if (awsSev === "critical" || awsSev === "high") {
    borderColor = awsSev === "critical" ? "#dc2626" : "#ea580c";
    bgColor = awsSev === "critical" ? "#450a0a" : "#431407";
  }

  const title = [data.validationError, data.awsReviewTitle].filter(Boolean).join(" · ") || undefined;

  return (
    <div
      className={`pipeline-node ${shapeClass} ${selected ? "selected" : ""} ${invalid ? "invalid" : ""}`}
      style={{ borderColor, background: bgColor }}
      title={title}
    >
      {!NO_TARGET.has(bt) && (
        <Handle type="target" position={Position.Left} className="handle" id="in" />
      )}

      <div className="node-icon" aria-hidden>
        {style.icon}
      </div>
      <div className="node-type">{bt.replace("_", " ")}</div>
      <div className="node-label">{data.label}</div>
      <div className="node-detail">{data.validationError || data.detail}</div>
      {awsIssues > 0 && (
        <span className={`node-aws-badge sev-${awsSev || "medium"}`} title={data.awsReviewTitle}>
          AWS {awsIssues}
        </span>
      )}

      {!NO_SOURCE.has(bt) && !MULTI_SOURCE.has(bt) && (
        <Handle type="source" position={Position.Right} className="handle" id="out" />
      )}

      {bt === "parallel" && (
        <>
          <Handle type="source" position={Position.Right} className="handle handle-branch" id="b1" style={{ top: "28%" }} />
          <Handle type="source" position={Position.Right} className="handle handle-branch" id="b2" style={{ top: "50%" }} />
          <Handle type="source" position={Position.Right} className="handle handle-branch" id="b3" style={{ top: "72%" }} />
          <Handle type="source" position={Position.Right} className="handle handle-merge" id="merge" style={{ top: "88%" }} />
        </>
      )}

      {bt === "choice" && (
        <>
          <Handle type="source" position={Position.Right} className="handle handle-branch" id="route-a" style={{ top: "35%" }} />
          <Handle type="source" position={Position.Right} className="handle handle-branch" id="route-b" style={{ top: "65%" }} />
        </>
      )}
    </div>
  );
}

export default memo(PipelineNode);
