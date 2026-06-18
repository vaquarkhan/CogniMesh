/**
 * Monotonic node IDs for React Flow — sync from loaded graph to avoid duplicates.
 */
export function syncNodeIdCounter(nodes) {
  let max = 0;
  for (const n of nodes || []) {
    const match = /^node-(\d+)$/.exec(n.id || "");
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function createNodeIdFactory() {
  let seq = 0;
  return {
    sync(nodes) {
      seq = syncNodeIdCounter(nodes);
    },
    next() {
      seq += 1;
      return `node-${seq}`;
    },
  };
}
