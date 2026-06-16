import { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";

import PipelineNode from "./PipelineNode";

const nodeTypes = { pipeline: PipelineNode };

const MINIMAP_COLORS = {
  start: "#10b981",
  parallel: "#fb923c",
  merge: "#fdba74",
  choice: "#22d3ee",
  map: "#a78bfa",
  pass: "#94a3b8",
  integrity_gate: "#f87171",
  source: "#059669",
  transform: "#2563eb",
  sink: "#ea580c",
};

export default function PipelineFlow({
  nodes,
  edges,
  setNodes,
  setEdges,
  pushHistory,
  reactFlowInstance,
  setSelectedId,
  onDrop,
  onDragOver,
}) {
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => {
        const next = addEdge({ ...params, animated: true }, eds);
        pushHistory(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, pushHistory]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={(inst) => {
        if (reactFlowInstance) reactFlowInstance.current = inst;
      }}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onNodeClick={(_, node) => setSelectedId(node.id)}
      onPaneClick={() => setSelectedId(null)}
      fitView
      deleteKeyCode={["Backspace", "Delete"]}
    >
      <Background gap={20} color="#243044" />
      <Controls />
      <MiniMap nodeColor={(n) => MINIMAP_COLORS[n.data?.blockType] || "#6b7280"} />
    </ReactFlow>
  );
}
