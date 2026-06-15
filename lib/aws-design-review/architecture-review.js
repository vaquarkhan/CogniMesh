"use strict";

function finding(base) {
  return {
    severity: "medium",
    category: "architecture",
    pillar: "Architecture",
    awsServices: [],
    nodeIds: [],
    waReference: null,
    ...base,
  };
}

function nodesByType(nodes, blockType) {
  return nodes.filter((n) => n.data?.blockType === blockType);
}

function hasPath(edges, fromId, toId) {
  const visited = new Set();
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === toId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const e of edges) {
      if (e.source === cur) queue.push(e.target);
    }
  }
  return false;
}

/**
 * AWS Well-Architected + Vaquar Pattern architecture review.
 */
function runArchitectureReview({ nodes, edges, pipelineMeta, contract, workflowStats }) {
  const findings = [];
  const sources = nodesByType(nodes, "source");
  const sinks = nodesByType(nodes, "sink");
  const transforms = nodesByType(nodes, "transform");
  const parallels = nodesByType(nodes, "parallel");
  const merges = nodesByType(nodes, "merge");
  const choices = nodesByType(nodes, "choice");
  const gates = nodesByType(nodes, "integrity_gate");
  const starts = nodesByType(nodes, "start");

  if (nodes.length === 0) {
    return { findings: [], passed: true };
  }

  if (sources.length === 0) {
    findings.push(
      finding({
        id: "arch.no_source",
        severity: "critical",
        pillar: "Reliability",
        title: "Pipeline has no source",
        message: "Every data product needs at least one ingress point.",
        fix: "Add a Source block (RDS, S3, Kafka) or load a pattern.",
        nodeIds: [],
        awsServices: ["Glue", "DMS"],
        waReference: "REL-01",
      })
    );
  }

  if (sinks.length === 0) {
    findings.push(
      finding({
        id: "arch.no_sink",
        severity: "critical",
        pillar: "Reliability",
        title: "Pipeline has no sink",
        message: "Data must land in a durable target (Iceberg gold, S3, catalog).",
        fix: "Add a Sink block with s3:// or Glue catalog table.",
        nodeIds: [],
        awsServices: ["S3", "Glue"],
        waReference: "REL-01",
      })
    );
  }

  if (parallels.length > 0 && merges.length === 0) {
    findings.push(
      finding({
        id: "arch.parallel_no_merge",
        severity: "high",
        pillar: "Reliability",
        title: "Parallel branch without Merge",
        message: "Step Functions Parallel states need a Merge or downstream join before PVDM gate.",
        fix: "Connect parallel branch outputs to a Merge block, then to transform/sink.",
        nodeIds: parallels.map((p) => p.id),
        awsServices: ["Step Functions"],
        waReference: "REL-02",
      })
    );
  }

  if (choices.length > 0) {
    for (const ch of choices) {
      const outEdges = edges.filter((e) => e.source === ch.id);
      if (outEdges.length < 2) {
        findings.push(
          finding({
            id: "arch.choice_routes",
            severity: "medium",
            pillar: "Reliability",
            title: "Choice block needs multiple routes",
            message: `"${ch.data?.label || ch.id}" has fewer than 2 outgoing routes.`,
            fix: "Wire route-a and route-b to different transforms or sinks; add Default pass state.",
            nodeIds: [ch.id],
            awsServices: ["Step Functions"],
            waReference: "REL-02",
          })
        );
      }
      const hasDefault = outEdges.some((e) => e.sourceHandle === "route-b" || e.label === "default");
      if (!hasDefault) {
        findings.push(
          finding({
            id: "arch.choice_default",
            severity: "low",
            pillar: "Reliability",
            title: "Choice missing default route",
            message: "Unhandled conditions should fall through to a safe default (Pass or DLQ).",
            fix: "Add a Default → Pass or quarantine sink for unmatched conditions.",
            nodeIds: [ch.id],
            awsServices: ["Step Functions"],
            waReference: "REL-02",
          })
        );
      }
    }
  }

  const layerLabels = transforms.map((t) => (t.data?.label || "").toLowerCase());
  const hasBronze = layerLabels.some((l) => l.includes("bronze"));
  const hasSilver = layerLabels.some((l) => l.includes("silver"));
  const hasGold = layerLabels.some((l) => l.includes("gold") || l.includes("curated"));
  const multiTransform = transforms.length >= 2;

  if (multiTransform && !hasBronze && !hasSilver && !hasGold) {
    findings.push(
      finding({
        id: "arch.medallion_layers",
        severity: "medium",
        pillar: "Performance",
        title: "Multi-transform pipeline without medallion layers",
        message: "Lakehouse best practice: Bronze (raw) → Silver (cleaned) → Gold (curated).",
        fix: "Rename transforms to Bronze/Silver/Gold or load the Medallion Full Stack pattern.",
        nodeIds: transforms.map((t) => t.id),
        awsServices: ["S3", "Glue", "Iceberg"],
        waReference: "PERF-01",
      })
    );
  }

  if (hasGold && !hasBronze) {
    findings.push(
      finding({
        id: "arch.medallion_skip_bronze",
        severity: "low",
        pillar: "Performance",
        title: "Gold layer without bronze retention",
        message: "Skipping bronze limits replay and audit for raw ingest.",
        fix: "Add bronze S3 prefix with lifecycle (30d IA) before silver SQL.",
        nodeIds: transforms.map((t) => t.id),
        awsServices: ["S3"],
        waReference: "PERF-04",
      })
    );
  }

  const pattern = contract?.spec?.execution?.pattern;
  if (pattern === "vaquar" && gates.length === 0) {
    findings.push(
      finding({
        id: "arch.vaquar_pvdm",
        severity: "high",
        pillar: "Operational Excellence",
        title: "Vaquar pattern requires PVDM gate",
        message: "Physical → Verify → Metadata must include integrity gate + VRP proof path.",
        fix: "Add Integrity Gate block; enable PVDM in transform properties.",
        nodeIds: [],
        awsServices: ["Step Functions", "Lambda", "S3"],
        waReference: "OPS-02",
      })
    );
  }

  if (!contract?.spec?.transform?.pvdm && sinks.some((s) => s.data?.sinkType === "iceberg")) {
    findings.push(
      finding({
        id: "arch.pvdm_iceberg",
        severity: "medium",
        pillar: "Operational Excellence",
        title: "Iceberg sink without PVDM quality policy",
        message: "Proof-gated commits require qualityPolicyId on PVDM transform.",
        fix: "Enable PVDM with strict-zero-drop or audit-only SparkRules in transform block.",
        nodeIds: transforms.map((t) => t.id),
        awsServices: ["Iceberg", "Glue"],
        waReference: "OPS-02",
      })
    );
  }

  if (!pipelineMeta?.schemaEvolutionPolicy && !contract?.spec?.schemaEvolution?.policy) {
    findings.push(
      finding({
        id: "arch.schema_evolution",
        severity: "medium",
        pillar: "Operational Excellence",
        title: "Schema evolution policy not set",
        message: "Breaking schema changes can fail downstream Athena/QuickSight consumers.",
        fix: "Set schemaEvolutionPolicy to compatible (add columns) or strict (reject changes).",
        nodeIds: [],
        awsServices: ["Glue", "Athena"],
        waReference: "OPS-01",
      })
    );
  }

  if (sources.length > 1 && parallels.length === 0) {
    findings.push(
      finding({
        id: "arch.multi_source_parallel",
        severity: "medium",
        pillar: "Performance",
        title: "Multiple sources should use Parallel state",
        message: `${sources.length} sources without Parallel block — sequential ingest adds latency.`,
        fix: "Insert Parallel block after Start; fan out each source to its transform branch.",
        nodeIds: sources.map((s) => s.id),
        awsServices: ["Step Functions", "Glue"],
        waReference: "PERF-02",
      })
    );
  }

  if (starts.length > 1) {
    findings.push(
      finding({
        id: "arch.multiple_starts",
        severity: "high",
        pillar: "Reliability",
        title: "Multiple Start blocks",
        message: "Step Functions allows exactly one entry state.",
        fix: "Keep one Start block; use Parallel for fan-out.",
        nodeIds: starts.map((s) => s.id),
        awsServices: ["Step Functions"],
        waReference: "REL-02",
      })
    );
  }

  for (const gate of gates) {
    const hasDownstream = edges.some((e) => e.source === gate.id);
    const hasUpstream = edges.some((e) => e.target === gate.id);
    if (!hasUpstream || !hasDownstream) {
      findings.push(
        finding({
          id: "arch.gate_wiring",
          severity: "high",
          pillar: "Operational Excellence",
          title: "Integrity gate not wired in flow",
          message: "Gate must sit between transform and sink in the ASL definition.",
          fix: "Connect Transform → Integrity Gate → Sink.",
          nodeIds: [gate.id],
          awsServices: ["Step Functions", "Lambda"],
          waReference: "OPS-02",
        })
      );
    }
  }

  if (workflowStats?.orphanNodes?.length) {
    findings.push(
      finding({
        id: "arch.orphan_nodes",
        severity: "high",
        pillar: "Reliability",
        title: "Orphan nodes in workflow graph",
        message: `${workflowStats.orphanNodes.length} node(s) not reachable from Start.`,
        fix: "Connect all blocks to the main flow or remove unused nodes.",
        nodeIds: workflowStats.orphanNodes,
        awsServices: ["Step Functions"],
        waReference: "REL-01",
      })
    );
  }

  const sink = sinks[0];
  if (sink && transforms[0] && !hasPath(edges, transforms[transforms.length - 1].id, sink.id) && gates.length === 0) {
    const lastTransform = transforms[transforms.length - 1];
    if (!edges.some((e) => e.source === lastTransform.id)) {
      findings.push(
        finding({
          id: "arch.disconnected_sink",
          severity: "critical",
          pillar: "Reliability",
          title: "Sink not connected to transform",
          message: "Data path is broken — deploy will produce empty outputs.",
          fix: "Draw edge from last transform (or merge) to sink.",
          nodeIds: [sink.id, lastTransform.id],
          awsServices: ["Step Functions"],
          waReference: "REL-01",
        })
      );
    }
  }

  if (pipelineMeta?.executionMode === "batch" && !pipelineMeta?.schedule && !transforms.some((t) => t.data?.schedule)) {
    findings.push(
      finding({
        id: "arch.batch_schedule",
        severity: "medium",
        pillar: "Operational Excellence",
        title: "Batch pipeline missing schedule",
        message: "EventBridge cron triggers Step Functions on the defined schedule.",
        fix: "Set schedule cron (e.g. 0 6 * * *) in pipeline metadata or transform block.",
        nodeIds: transforms.map((t) => t.id),
        awsServices: ["EventBridge", "Step Functions"],
        waReference: "OPS-01",
      })
    );
  }

  if (sources.length === 1 && sources[0]?.data?.sourceType === "rds" && !sources[0]?.data?.cdcEnabled) {
    findings.push(
      finding({
        id: "arch.cdc_recommended",
        severity: "low",
        pillar: "Performance",
        title: "RDS batch without CDC",
        message: "Full-table scans increase cost and lock time on OLTP databases.",
        fix: "Enable CDC (DMS/Glue CDC) for incremental medallion bronze layer.",
        nodeIds: [sources[0].id],
        awsServices: ["DMS", "Glue"],
        waReference: "PERF-03",
      })
    );
  }

  findings.push(
    finding({
      id: "arch.terraform_alignment",
      severity: "info",
      pillar: "Operational Excellence",
      title: "CogniMesh Terraform module map",
      message: "Your design maps to: networking (VPC) → storage (S3) → iam → glue → orchestration (SFN) → governance (LF) → lambda (integrity gate).",
      fix: "Run terraform plan in environments/prod after portal deploy preview passes.",
      nodeIds: [],
      awsServices: ["Terraform", "VPC", "S3", "Step Functions", "Glue", "Lake Formation"],
      waReference: "OPS-05",
    })
  );

  return {
    findings,
    passed: !findings.some((f) => f.severity === "critical" || f.severity === "high"),
  };
}

module.exports = { runArchitectureReview };
