import { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";

const TYPE_COLORS = {
  source: "#059669",
  medallion: "#2563eb",
  target: "#d97706",
  governance: "#7c3aed",
  marketplace: "#0d9488",
  consumer: "#64748b",
  runtime: "#1d4ed8",
};

function toFlowGraph(lineage) {
  if (!lineage?.nodes?.length) return { nodes: [], edges: [] };

  const nodes = lineage.nodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % 3) * 180, y: Math.floor(i / 3) * 100 },
    data: {
      label: `${n.label}${n.proofGated || n.type === "governance" ? "\n🛡 VRP proof" : ""}\n${n.detail || ""}`.trim(),
    },
    style: {
      background: TYPE_COLORS[n.type] || "#334155",
      color: "#fff",
      border: "1px solid #1e293b",
      borderRadius: 8,
      fontSize: 11,
      padding: 8,
      minWidth: 120,
    },
  }));

  const edges = (lineage.edges || []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
  }));

  return { nodes, edges };
}

export default function LineageGraph({ lineage, height = 280 }) {
  const { nodes, edges } = useMemo(() => toFlowGraph(lineage), [lineage]);

  if (!lineage) {
    return <p className="properties-hint">No lineage graph available.</p>;
  }

  return (
    <div className="lineage-graph" style={{ height }}>
      <div className="lineage-meta">
        <span>{lineage.productKey}</span>
        <span>v{lineage.version}</span>
        <span className="lineage-policy">schema: {lineage.schemaEvolution?.policy || "compatible"}</span>
        {lineage.proofGated && <span className="proof-gated-tag">🛡 Proof-gated</span>}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
      >
        <Background gap={16} color="#243044" />
        <MiniMap nodeColor={(n) => n.style?.background || "#334155"} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
