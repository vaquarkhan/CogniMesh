"use strict";

const { buildSource, buildTransform, buildTarget, slugify, buildOwner } = require("./graph-to-contract");
const { validateWorkflowGraph, isWorkflowGraph } = require("./graph-to-workflow");

/**
 * Multi-node graph → DataContract (primary path + workflow manifest).
 * Backward compatible: simple 1-1-1 graphs still work via graph-to-contract.js
 */

function graphToWorkflowContract(nodes, edges, pipelineMeta = {}) {
  const check = validateWorkflowGraph(nodes, edges);
  if (!check.valid) {
    return { success: false, errors: check.errors };
  }

  const sources = nodes.filter((n) => n.data.blockType === "source");
  const transforms = nodes.filter((n) => n.data.blockType === "transform");
  const sinks = nodes.filter((n) => n.data.blockType === "sink");

  const sourceNode = sources[0];
  const transformNode = transforms[0] || {
    data: { transformType: "spark_sql", executionMode: "batch", schedule: "0 0 * * *", sparkSql: "SELECT 1" },
  };
  const sinkNode = sinks[0];

  const name = slugify(pipelineMeta.name || "portal-workflow");
  const domain = pipelineMeta.domain || "default";
  const version = pipelineMeta.version || "0.1.0";
  const executionMode = pipelineMeta.executionMode || transformNode.data.executionMode || "batch";
  const explicitPattern = pipelineMeta.executionPattern || transformNode.data.executionPattern;
  const executionPattern =
    explicitPattern ||
    (transforms.some((t) => t.data.transformType === "agentic") ? "cognitive" : "vaquar");

  const owner = buildOwner(pipelineMeta);

  const contract = {
    apiVersion: "cognimesh.io/v1",
    kind: "DataContract",
    metadata: {
      name,
      domain,
      version,
      description:
        pipelineMeta.description ||
        `Multi-step workflow (${sources.length} sources, ${transforms.length} transforms, ${sinks.length} sinks)`,
      ...(owner && { owner }),
      tags: {
        ...(pipelineMeta.tags || {}),
        origin: "portal",
        workflow: "graph",
      },
    },
    spec: {
      execution: {
        mode: executionMode,
        pattern: executionPattern,
        ...(executionMode === "batch" && {
          schedule: pipelineMeta.schedule || transformNode.data.schedule || "0 0 * * *",
        }),
        slaMinutes: Number(pipelineMeta.slaMinutes || 120),
      },
      source: buildSource(sourceNode, pipelineMeta),
      transform: buildTransform(transformNode, sourceNode),
      target: buildTarget(sinkNode),
      schemaEvolution: {
        policy: pipelineMeta.schemaEvolutionPolicy || "compatible",
        onNewColumn: pipelineMeta.onNewColumn || "add_nullable",
        onRemovedColumn: pipelineMeta.onRemovedColumn || "reject",
      },
      workflow: {
        mode: "graph",
        graph: {
          nodes: nodes.map((n) => ({
            id: n.id,
            blockType: n.data.blockType,
            label: n.data.label,
            position: n.position,
            config: { ...n.data },
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
          })),
        },
        sources: sources.map((n) => buildSource(n, pipelineMeta)),
        transforms: transforms.map((n) => buildTransform(n, sources[0])),
        targets: sinks.map((n) => buildTarget(n)),
      },
    },
  };

  if (pipelineMeta.piiClassification || sourceNode?.data.sourceType === "rds") {
    contract.spec.governance = {
      piiClassification: pipelineMeta.piiClassification || "medium",
    };
  }

  // Vaquar (PVDM proof-gating) is opt-in. When the user picks a non-vaquar pattern
  // (e.g. "standard"), strip the pvdm block so the pipeline is a plain ETL with no
  // proof-gate, VRP, or synthetic PVDM run.
  if (executionPattern !== "vaquar") {
    if (contract.spec.transform) delete contract.spec.transform.pvdm;
    for (const t of contract.spec.workflow?.transforms || []) delete t.pvdm;
  }

  return { success: true, contract, workflowStats: check.stats };
}

function graphToContractSmart(nodes, edges, pipelineMeta) {
  if (isWorkflowGraph(nodes)) {
    return graphToWorkflowContract(nodes, edges, pipelineMeta);
  }
  const { graphToContract } = require("./graph-to-contract");
  return graphToContract(nodes, edges, pipelineMeta);
}

module.exports = { graphToWorkflowContract, graphToContractSmart };
