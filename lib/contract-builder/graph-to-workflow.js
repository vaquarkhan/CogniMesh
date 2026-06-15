"use strict";

/**
 * Compile React Flow workflow graphs → AWS Step Functions ASL.
 * Supports many sources, transforms, sinks, plus Parallel / Choice / Merge flow states.
 */

const FLOW_TYPES = new Set(["start", "parallel", "choice", "merge", "map", "pass", "integrity_gate"]);
const DATA_TYPES = new Set(["source", "transform", "sink"]);

function slug(name) {
  return String(name || "State")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "State";
}

function stateNameFor(node) {
  return `${slug(node.data.blockType)}_${slug(node.id)}`;
}

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
  const explicit = nodes.filter((n) => n.data.blockType === "start");
  if (explicit.length) return explicit;
  return nodes.filter((n) => (incoming.get(n.id) || []).length === 0);
}

function findMergeTargets(nodes, incoming) {
  return nodes.filter((n) => n.data.blockType === "merge" || (incoming.get(n.id) || []).length > 1);
}

function validateWorkflowGraph(nodes, edges) {
  const errors = [];
  if (!nodes.length) {
    return { valid: false, errors: ["Add at least one block to the canvas"] };
  }

  const sources = nodes.filter((n) => n.data.blockType === "source");
  const sinks = nodes.filter((n) => n.data.blockType === "sink");
  const transforms = nodes.filter((n) => n.data.blockType === "transform");

  if (!sources.length) errors.push("Add at least one Source block");
  if (!sinks.length) errors.push("Add at least one Sink block");

  const { incoming } = buildAdjacency(nodes, edges);
  const starts = findStartNodes(nodes, incoming);
  if (!starts.length) errors.push("Workflow has no entry point — add a Start block or connect sources");

  // Reachability from starts
  const reachable = new Set();
  const stack = starts.map((n) => n.id);
  const outgoing = buildAdjacency(nodes, edges).outgoing;
  while (stack.length) {
    const id = stack.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const e of outgoing.get(id) || []) stack.push(e.target);
  }
  const orphanNodes = [];
  for (const n of nodes) {
    if (!reachable.has(n.id) && n.data.blockType !== "start") {
      errors.push(`Block "${n.data.label || n.id}" is not connected to the workflow`);
      orphanNodes.push(n.id);
    }
  }

  for (const n of nodes) {
    if (n.data.blockType === "source") {
      const st = n.data.sourceType;
      if ((st === "rds" || st === "mysql") && !n.data.database) {
        errors.push(`Source "${n.data.label}": database required`);
      }
    }
    if (n.data.blockType === "sink" && !n.data.location) {
      errors.push(`Sink "${n.data.label}": S3 / location required`);
    }
    if (n.data.blockType === "transform" && n.data.transformType === "spark_sql" && !n.data.sparkSql?.trim()) {
      errors.push(`Transform "${n.data.label}": Spark SQL required`);
    }
    if (n.data.blockType === "parallel") {
      const out = (outgoing.get(n.id) || []).length;
      if (out < 2) errors.push(`Parallel "${n.data.label}": connect at least 2 branches`);
    }
    if (n.data.blockType === "choice") {
      const out = (outgoing.get(n.id) || []).length;
      if (out < 2) errors.push(`Choice "${n.data.label}": connect at least 2 routes`);
    }
  }

  return { valid: errors.length === 0, errors, orphanNodes, stats: { sources: sources.length, transforms: transforms.length, sinks: sinks.length } };
}

function taskStateForNode(node, prefix) {
  const label = node.data.label || node.data.blockType;
  switch (node.data.blockType) {
    case "start":
      return { Type: "Pass", Comment: label, Result: { started: true } };
    case "integrity_gate":
      return {
        Type: "Task",
        Comment: label,
        Resource: "arn:aws:states:::lambda:invoke",
        Parameters: {
          FunctionName: `${prefix}-integrity-gate`,
          Payload: { gate: "design-time" },
        },
        ResultPath: "$.gate",
      };
    case "source":
      return {
        Type: "Task",
        Comment: label,
        Resource: "arn:aws:states:::glue:startJobRun.sync",
        Parameters: {
          JobName: `${prefix}-extract-${node.data.sourceType || "source"}`,
          Arguments: {
            "--table": node.data.table || "",
            "--database": node.data.database || "",
          },
        },
      };
    case "transform":
      if (node.data.transformType === "agentic") {
        return {
          Type: "Task",
          Comment: label,
          Resource: "arn:aws:states:::eks:runJob.sync",
          Parameters: { Job: { "metadata.name": `${prefix}-agentic-${slug(node.id)}` } },
        };
      }
      return {
        Type: "Task",
        Comment: label,
        Resource: "arn:aws:states:::glue:startJobRun.sync",
        Parameters: { JobName: `${prefix}-transform-${slug(node.id)}` },
      };
    case "sink":
      return {
        Type: "Task",
        Comment: label,
        Resource: "arn:aws:states:::glue:startJobRun.sync",
        Parameters: {
          JobName: `${prefix}-load-${node.data.targetType || "iceberg"}`,
          Arguments: { "--location": node.data.location || "" },
        },
      };
    case "merge":
      return { Type: "Pass", Comment: label, Result: { merged: true } };
    case "pass":
      return { Type: "Pass", Comment: label };
    case "map":
      return {
        Type: "Map",
        Comment: label,
        ItemsPath: node.data.itemsPath || "$.items",
        MaxConcurrency: Number(node.data.maxConcurrency || 10),
        Iterator: {
          StartAt: "MapProcess",
          States: {
            MapProcess: {
              Type: "Pass",
              End: true,
            },
          },
        },
      };
    default:
      return { Type: "Pass", Comment: label };
  }
}

/** Linear chain from startId until stopId (exclusive) or end. */
function linearChainStates(nodes, edges, startId, stopId, prefix, states) {
  let current = startId;
  let prevName = null;
  const visited = new Set();

  while (current && current !== stopId && !visited.has(current)) {
    visited.add(current);
    const node = nodes.find((n) => n.id === current);
    if (!node) break;

    const name = stateNameFor(node);
    if (states[name]) {
      prevName = name;
      break;
    }

    const out = edges.filter((e) => e.source === current);
    if (node.data.blockType === "parallel") break;
    if (node.data.blockType === "choice") break;

    states[name] = taskStateForNode(node, prefix);
    if (prevName) states[prevName].Next = name;

    if (out.length === 0) {
      states[name].End = true;
      return { last: name, terminal: true };
    }
    if (out.length > 1) break;

    prevName = name;
    current = out[0].target;
  }
  return { last: prevName, terminal: false, stoppedAt: current };
}

function compileBranchSubgraph(nodes, edges, branchStartId, mergeId, prefix) {
  const states = {};
  linearChainStates(nodes, edges, branchStartId, mergeId, prefix, states);
  const startAt = Object.keys(states)[0];
  if (!startAt) {
    return {
      StartAt: "EmptyBranch",
      States: { EmptyBranch: { Type: "Pass", End: true } },
    };
  }
  return { StartAt: startAt, States: states };
}

function compileGraphToStateMachine(nodes, edges, pipelineMeta = {}) {
  const validation = validateWorkflowGraph(nodes, edges);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const prefix = pipelineMeta.namePrefix || process.env.AWS_NAME_PREFIX || "cognimesh";
  const { outgoing, incoming } = buildAdjacency(nodes, edges);
  const starts = findStartNodes(nodes, incoming);
  const states = {};
  const startNode = starts[0];
  let cursor = startNode.id;
  let prevName = null;

  const link = (from, to, end = false) => {
    if (from && states[from]) {
      if (end) {
        delete states[from].Next;
        states[from].End = true;
      } else if (to) {
        states[from].Next = to;
      }
    }
  };

  const visited = new Set();
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const node = nodes.find((n) => n.id === cursor);
    if (!node) break;
    const name = stateNameFor(node);
    const out = outgoing.get(cursor) || [];

    if (node.data.blockType === "parallel") {
      const mergeEdge = out.find((e) => {
        const t = nodes.find((n) => n.id === e.target);
        return t?.data.blockType === "merge";
      });
      const mergeId = mergeEdge?.target;
      const branchEdges = out.filter((e) => e.target !== mergeId);

      states[name] = {
        Type: "Parallel",
        Comment: node.data.label || "Parallel",
        Branches: branchEdges.map((e) =>
          compileBranchSubgraph(nodes, edges, e.target, mergeId, prefix)
        ),
      };
      if (mergeId) {
        const mergeNode = nodes.find((n) => n.id === mergeId);
        const mergeName = stateNameFor(mergeNode);
        states[mergeName] = taskStateForNode(mergeNode, prefix);
        states[name].Next = mergeName;
        prevName = mergeName;
        const afterMerge = outgoing.get(mergeId) || [];
        cursor = afterMerge[0]?.target || null;
        if (!cursor) {
          states[mergeName].End = true;
          break;
        }
        continue;
      }
      states[name].End = true;
      break;
    }

    if (node.data.blockType === "choice") {
      states[name] = {
        Type: "Choice",
        Comment: node.data.label || "Choice",
        Choices: out.map((e, i) => ({
          Variable: e.data?.condition || `$.route == '${e.label || `branch_${i}`}'`,
          StringEquals: e.data?.value || e.label || String(i),
          Next: stateNameFor(nodes.find((n) => n.id === e.target)),
        })),
        Default: out.length
          ? stateNameFor(nodes.find((n) => n.id === out[out.length - 1].target))
          : undefined,
      };
      prevName = name;
      cursor = null;
      break;
    }

    states[name] = taskStateForNode(node, prefix);
    if (prevName) link(prevName, name);

    if (out.length === 0) {
      states[name].End = true;
      break;
    }
    if (out.length === 1) {
      prevName = name;
      cursor = out[0].target;
      continue;
    }
    prevName = name;
    cursor = out[0].target;
  }

  const startAt = stateNameFor(startNode);
  if (!states[startAt]) {
    const firstData = nodes.find((n) => DATA_TYPES.has(n.data.blockType));
    if (firstData) {
      const fn = stateNameFor(firstData);
      states[fn] = taskStateForNode(firstData, prefix);
      states[fn].End = true;
      return {
        success: true,
        stateMachine: {
          Comment: `CogniMesh workflow: ${pipelineMeta.name || "pipeline"}`,
          StartAt: fn,
          States: states,
          cognimesh: { mode: "workflow-graph", nodeCount: nodes.length },
        },
      };
    }
  }

  return {
    success: true,
    stateMachine: {
      Comment: `CogniMesh workflow: ${pipelineMeta.name || "pipeline"}`,
      StartAt: startAt,
      States: states,
      cognimesh: {
        mode: "workflow-graph",
        nodeCount: nodes.length,
        edgeCount: edges.length,
        ...validation.stats,
      },
    },
  };
}

function isWorkflowGraph(nodes) {
  if (!nodes?.length) return false;
  const sources = nodes.filter((n) => n.data.blockType === "source").length;
  const sinks = nodes.filter((n) => n.data.blockType === "sink").length;
  const flows = nodes.filter((n) => FLOW_TYPES.has(n.data.blockType)).length;
  return sources > 1 || sinks > 1 || flows > 0 || nodes.length > 3;
}

module.exports = {
  compileGraphToStateMachine,
  validateWorkflowGraph,
  isWorkflowGraph,
  FLOW_TYPES,
  DATA_TYPES,
};
