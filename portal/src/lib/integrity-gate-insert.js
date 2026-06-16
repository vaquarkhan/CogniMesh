/**
 * Insert an Integrity Gate between the first transform→sink edge (or upstream→sink).
 */

export function insertIntegrityGate(nodes, edges, nextId) {
  if (nodes.some((n) => n.data?.blockType === "integrity_gate")) {
    return { nodes, edges, added: false, reason: "Integrity gate already exists" };
  }

  const edge =
    edges.find((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      return src?.data?.blockType === "transform" && tgt?.data?.blockType === "sink";
    }) ||
    edges.find((e) => {
      const tgt = nodes.find((n) => n.id === e.target);
      return tgt?.data?.blockType === "sink";
    });

  if (!edge) {
    return { nodes, edges, added: false, reason: "No path to a sink block found" };
  }

  const sourceNode = nodes.find((n) => n.id === edge.source);
  const sinkNode = nodes.find((n) => n.id === edge.target);
  if (!sourceNode || !sinkNode) {
    return { nodes, edges, added: false, reason: "Could not resolve edge endpoints" };
  }

  const gateId = typeof nextId === "function" ? nextId() : `gate-${Date.now()}`;
  const gateNode = {
    id: gateId,
    type: "pipeline",
    position: {
      x: Math.round((sourceNode.position.x + sinkNode.position.x) / 2),
      y: Math.round((sourceNode.position.y + sinkNode.position.y) / 2),
    },
    data: {
      label: "Integrity Gate",
      blockType: "integrity_gate",
      awsService: "lambda",
      detail: "Vaquar PVDM",
    },
  };

  const newEdges = edges
    .filter((e) => e.id !== edge.id)
    .concat(
      { id: `e-${gateId}-in`, source: edge.source, target: gateId, animated: true },
      { id: `e-${gateId}-out`, source: gateId, target: edge.target, animated: true }
    );

  return {
    nodes: [...nodes, gateNode],
    edges: newEdges,
    added: true,
    gateId,
  };
}
