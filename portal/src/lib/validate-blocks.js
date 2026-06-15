/**
 * Client-side workflow validation — mirrors lib/contract-builder/graph-to-workflow.js
 */

const FLOW_TYPES = new Set(["start", "parallel", "choice", "merge", "map", "pass", "integrity_gate"]);

function buildAdjacency(nodes, edges) {
  const outgoing = new Map(nodes.map((n) => [n.id, []]));
  const incoming = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    outgoing.get(e.source).push(e);
    incoming.get(e.target).push(e);
  }
  return { outgoing, incoming };
}

function findStartNodes(nodes, incoming) {
  const explicit = nodes.filter((n) => n.data?.blockType === "start");
  if (explicit.length) return explicit;
  return nodes.filter((n) => (incoming.get(n.id) || []).length === 0);
}

export function isWorkflowGraph(nodes) {
  if (!nodes?.length) return false;
  const sources = nodes.filter((n) => n.data?.blockType === "source").length;
  const sinks = nodes.filter((n) => n.data?.blockType === "sink").length;
  const flows = nodes.filter((n) => FLOW_TYPES.has(n.data?.blockType)).length;
  return sources > 1 || sinks > 1 || flows > 0 || nodes.length > 3;
}

function validateSimplePipeline(nodes, edges) {
  const errors = [];
  const byNode = {};

  const source = nodes.find((n) => n.data?.blockType === "source");
  const transform = nodes.find((n) => n.data?.blockType === "transform");
  const sink = nodes.find((n) => n.data?.blockType === "sink");

  for (const type of ["source", "transform", "sink"]) {
    const count = nodes.filter((n) => n.data?.blockType === type).length;
    if (count !== 1) errors.push(`Exactly one ${type} block required (found ${count})`);
  }

  if (source && transform && !edges.some((e) => e.source === source.id && e.target === transform.id)) {
    errors.push("Connect Source → Transform");
    byNode[source.id] = "Not connected to Transform";
  }

  if (transform && sink && !edges.some((e) => e.source === transform.id && e.target === sink.id)) {
    errors.push("Connect Transform → Sink");
    byNode[transform.id] = byNode[transform.id] || "Not connected to Sink";
  }

  if (source?.data?.blockType === "source") {
    const st = source.data.sourceType;
    if ((st === "rds" || st === "mysql") && !source.data.database) {
      byNode[source.id] = "Database name required";
      errors.push("Source: database name required");
    }
    if ((st === "rds" || st === "mysql") && !source.data.table) {
      byNode[source.id] = byNode[source.id] || "Table name required";
      errors.push("Source: table name required");
    }
  }

  if (sink?.data?.blockType === "sink" && !sink.data.location) {
    byNode[sink.id] = "S3 / Iceberg location required";
    errors.push("Sink: target location required");
  }

  if (transform?.data?.blockType === "transform" && transform.data.transformType === "spark_sql") {
    if (!transform.data.sparkSql?.trim()) {
      byNode[transform.id] = "Spark SQL required";
      errors.push("Transform: Spark SQL required");
    }
  }

  return { valid: errors.length === 0, errors, byNode };
}

function validateWorkflowGraph(nodes, edges) {
  const errors = [];
  const byNode = {};

  if (!nodes.length) {
    return { valid: false, errors: ["Add at least one block to the canvas"], byNode: {} };
  }

  const sources = nodes.filter((n) => n.data?.blockType === "source");
  const sinks = nodes.filter((n) => n.data?.blockType === "sink");
  const transforms = nodes.filter((n) => n.data?.blockType === "transform");

  if (!sources.length) errors.push("Add at least one Source block");
  if (!sinks.length) errors.push("Add at least one Sink block");

  const { outgoing, incoming } = buildAdjacency(nodes, edges);
  const starts = findStartNodes(nodes, incoming);
  if (!starts.length) errors.push("Workflow has no entry point — add a Start block or connect sources");

  const reachable = new Set();
  const stack = starts.map((n) => n.id);
  while (stack.length) {
    const id = stack.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const e of outgoing.get(id) || []) stack.push(e.target);
  }

  for (const n of nodes) {
    if (!reachable.has(n.id) && n.data?.blockType !== "start") {
      const msg = `Not connected to workflow`;
      errors.push(`Block "${n.data?.label || n.id}" is not connected to the workflow`);
      byNode[n.id] = msg;
    }
  }

  for (const n of nodes) {
    const d = n.data || {};
    if (d.blockType === "source") {
      const st = d.sourceType;
      if ((st === "rds" || st === "mysql") && !d.database) {
        byNode[n.id] = "Database required";
        errors.push(`Source "${d.label}": database required`);
      }
      if ((st === "rds" || st === "mysql") && !d.table) {
        byNode[n.id] = byNode[n.id] || "Table required";
        errors.push(`Source "${d.label}": table required`);
      }
    }
    if (d.blockType === "sink" && !d.location) {
      byNode[n.id] = "S3 location required";
      errors.push(`Sink "${d.label}": S3 / location required`);
    }
    if (d.blockType === "transform" && d.transformType === "spark_sql" && !d.sparkSql?.trim()) {
      byNode[n.id] = "Spark SQL required";
      errors.push(`Transform "${d.label}": Spark SQL required`);
    }
    if (d.blockType === "parallel") {
      const out = (outgoing.get(n.id) || []).length;
      if (out < 2) {
        byNode[n.id] = "Connect ≥2 branches";
        errors.push(`Parallel "${d.label}": connect at least 2 branches`);
      }
    }
    if (d.blockType === "choice") {
      const out = (outgoing.get(n.id) || []).length;
      if (out < 2) {
        byNode[n.id] = "Connect ≥2 routes";
        errors.push(`Choice "${d.label}": connect at least 2 routes`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    byNode,
    stats: { sources: sources.length, transforms: transforms.length, sinks: sinks.length },
  };
}

export function validateBlocks(nodes, edges) {
  if (isWorkflowGraph(nodes)) {
    return validateWorkflowGraph(nodes, edges);
  }
  return validateSimplePipeline(nodes, edges);
}
