"use strict";

const SEVERITY_WEIGHT = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

function computeScore(findings) {
  let score = 100;
  for (const f of findings) {
    score -= SEVERITY_WEIGHT[f.severity] ?? 5;
  }
  return Math.max(0, Math.min(100, score));
}

function grade(score) {
  if (score >= 90) return { label: "Production ready", color: "#059669" };
  if (score >= 75) return { label: "Minor fixes", color: "#ca8a04" };
  if (score >= 50) return { label: "Needs work", color: "#ea580c" };
  return { label: "Blocked", color: "#dc2626" };
}

function buildAwsTopology({ nodes, contract }) {
  const services = new Map();
  const connections = [];

  function addService(id, type, label, status = "ok") {
    if (!services.has(id)) services.set(id, { id, type, label, status });
    else if (status === "issue") services.get(id).status = "issue";
  }

  function link(a, b) {
    connections.push([a, b]);
  }

  addService("vpc", "vpc", "VPC · private subnets", "ok");
  addService("sfn", "sfn", "Step Functions", "ok");
  addService("glue", "glue", "Glue Data Catalog", "ok");
  addService("lf", "lf", "Lake Formation", "ok");
  addService("lambda-gate", "lambda", "Integrity Gate λ", "ok");
  addService("cloudtrail", "audit", "CloudTrail · audit", "ok");

  link("sfn", "lambda-gate");
  link("lambda-gate", "glue");
  link("glue", "lf");

  for (const n of nodes) {
    const d = n.data || {};
    const bt = d.blockType;

    if (bt === "source") {
      const st = d.sourceType || "s3";
      if (st === "rds" || st === "mysql") {
        addService("rds", "rds", "Amazon RDS", d.secretArn ? "ok" : "issue");
        addService("secrets", "secrets", "Secrets Manager", d.secretArn ? "ok" : "issue");
        link("vpc", "rds");
        link("rds", "secrets");
        link("secrets", "glue");
      } else if (st === "s3") {
        addService("s3-in", "s3", "S3 bronze ingress", "ok");
        link("s3-in", "glue");
      } else if (st === "kafka") {
        addService("msk", "kafka", "MSK / Kafka", "ok");
        link("msk", "glue");
      }
    }

    if (bt === "transform") {
      addService("glue-etl", "glue", "Glue / Spark ETL", "ok");
      link("glue", "glue-etl");
      if (d.transformType === "agentic") {
        addService("bedrock", "ai", "Bedrock / Agent", d.compensationHandler ? "ok" : "issue");
        link("glue-etl", "bedrock");
      }
    }

    if (bt === "integrity_gate") {
      addService("lambda-gate", "lambda", "Integrity Gate λ", "ok");
      addService("pvdm", "pvdm", "PVDM · VRP proof", "ok");
      link("lambda-gate", "pvdm");
    }

    if (bt === "sink") {
      const enc = d.encryption || d.location?.includes("kms") ? "ok" : "medium";
      addService("s3-gold", "s3", "S3 / Iceberg gold", enc === "ok" ? "ok" : "issue");
      addService("proof", "s3", "Proof bucket (VRP)", "ok");
      link("pvdm", "proof");
      link("proof", "s3-gold");
      link("s3-gold", "lf");
    }

    if (bt === "parallel" || bt === "choice") {
      addService("sfn", "sfn", "Step Functions", "ok");
    }
  }

  if (contract?.spec?.execution?.mode === "batch") {
    addService("events", "events", "EventBridge schedule", "ok");
    link("events", "sfn");
  }

  return {
    services: [...services.values()],
    connections,
    pattern: contract?.spec?.execution?.pattern || "vaquar",
  };
}

function indexFindingsByNode(findings) {
  const byNode = {};
  for (const f of findings) {
    for (const nid of f.nodeIds || []) {
      if (!byNode[nid]) byNode[nid] = [];
      byNode[nid].push(f);
    }
  }
  return byNode;
}

function runDesignReview({ nodes, edges, pipelineMeta, contract, integrityGate, workflowStats }) {
  const { runSecurityReview } = require("./security-review");
  const { runArchitectureReview } = require("./architecture-review");

  const security = runSecurityReview({ nodes, edges, pipelineMeta, contract, integrityGate });
  const architecture = runArchitectureReview({
    nodes,
    edges,
    pipelineMeta,
    contract,
    workflowStats,
  });

  const allFindings = [...security.findings, ...architecture.findings];
  const securityScore = computeScore(security.findings);
  const architectureScore = computeScore(architecture.findings);
  const overallScore = Math.round((securityScore + architectureScore) / 2);

  const criticalCount = allFindings.filter((f) => f.severity === "critical").length;
  const highCount = allFindings.filter((f) => f.severity === "high").length;

  return {
    security: {
      score: securityScore,
      grade: grade(securityScore),
      passed: security.passed,
      findings: security.findings,
      summary: `${security.findings.length} finding(s) · ${criticalCount} critical`,
    },
    architecture: {
      score: architectureScore,
      grade: grade(architectureScore),
      passed: architecture.passed,
      findings: architecture.findings,
      summary: `${architecture.findings.length} finding(s)`,
    },
    overall: {
      score: overallScore,
      grade: grade(overallScore),
      passed: security.passed && architecture.passed && criticalCount === 0,
      deployBlocked: criticalCount > 0,
      criticalCount,
      highCount,
    },
    findings: allFindings,
    findingsByNode: indexFindingsByNode(allFindings),
    topology: buildAwsTopology({ nodes, contract }),
    reviewedAt: new Date().toISOString(),
  };
}

module.exports = { runDesignReview, computeScore, grade, buildAwsTopology };
