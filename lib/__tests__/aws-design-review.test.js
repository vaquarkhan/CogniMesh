"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { runDesignReview } = require("../aws-design-review");

const RDS_GRAPH = {
  nodes: [
    { id: "s1", data: { blockType: "source", label: "Orders RDS", sourceType: "rds", database: "shop", table: "orders" } },
    { id: "t1", data: { blockType: "transform", label: "Silver SQL", transformType: "spark_sql", sparkSql: "SELECT 1" } },
    { id: "k1", data: { blockType: "integrity_gate", label: "PVDM Gate" } },
    { id: "o1", data: { blockType: "sink", label: "Gold", sinkType: "iceberg", location: "s3://lake/gold/", catalogDatabase: "gold" } },
  ],
  edges: [
    { id: "e1", source: "s1", target: "t1" },
    { id: "e2", source: "t1", target: "k1" },
    { id: "e3", source: "k1", target: "o1" },
  ],
  pipelineMeta: { name: "orders", domain: "retail", piiClassification: "medium" },
};

describe("aws-design-review", () => {
  it("does not flag secrets on default create-new RDS path", () => {
    const review = runDesignReview(RDS_GRAPH);
    assert.equal(review.security.findings.some((f) => f.id.startsWith("sec.secrets_manager")), false);
    assert.equal(review.security.findings.some((f) => f.id.startsWith("setup.rds_secret")), false);
    assert.ok(review.topology.services.some((s) => s.id === "rds"));
  });

  it("guides existing RDS without secret ARN (not critical)", () => {
    const graph = {
      ...RDS_GRAPH,
      nodes: RDS_GRAPH.nodes.map((n) =>
        n.id === "s1"
          ? { ...n, data: { ...n.data, rdsProvisioningMode: "existing" } }
          : n
      ),
    };
    const review = runDesignReview(graph);
    const finding = review.findings.find((f) => f.id.startsWith("setup.rds_secret"));
    assert.ok(finding);
    assert.equal(finding.severity, "medium");
  });

  it("passes existing RDS with secret ARN", () => {
    const graph = {
      ...RDS_GRAPH,
      nodes: RDS_GRAPH.nodes.map((n) =>
        n.id === "s1"
          ? {
              ...n,
              data: {
                ...n.data,
                rdsProvisioningMode: "existing",
                secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:orders-db",
                vpcSecurityGroup: "sg-abc",
              },
            }
          : n
      ),
    };
    const review = runDesignReview(graph);
    assert.equal(review.findings.some((f) => f.id.startsWith("sec.secrets_manager")), false);
    assert.equal(review.findings.some((f) => f.id.startsWith("setup.rds_secret")), false);
    assert.ok(review.overall.score >= 70);
  });

  it("flags parallel without merge in architecture", () => {
    const review = runDesignReview({
      nodes: [
        { id: "st", data: { blockType: "start" } },
        { id: "p", data: { blockType: "parallel" } },
        { id: "src", data: { blockType: "source", sourceType: "s3", endpoint: "s3://in/" } },
        { id: "snk", data: { blockType: "sink", location: "s3://out/" } },
      ],
      edges: [
        { id: "e1", source: "st", target: "p" },
        { id: "e2", source: "p", target: "src" },
        { id: "e3", source: "src", target: "snk" },
      ],
      pipelineMeta: { name: "wf", domain: "default" },
    });
    assert.ok(review.architecture.findings.some((f) => f.id === "arch.parallel_no_merge"));
  });

  it("buildFixPlans returns steps and property patch for secrets finding", () => {
    const { buildFixPlans } = require("../aws-design-review/fix-assistant");
    const existingRds = {
      ...RDS_GRAPH,
      nodes: RDS_GRAPH.nodes.map((n) =>
        n.id === "s1" ? { ...n, data: { ...n.data, rdsProvisioningMode: "existing" } } : n
      ),
    };
    const review = runDesignReview(existingRds);
    const secretId = review.findings.find((f) => f.id.startsWith("setup.rds_secret"))?.id;
    assert.ok(secretId);
    const plans = buildFixPlans({
      findings: review.findings,
      nodes: existingRds.nodes,
      pipelineMeta: RDS_GRAPH.pipelineMeta,
      findingIds: [secretId],
    });
    assert.equal(plans.length, 1);
    assert.ok(plans[0].steps.length >= 2);
  });

  it("buildFixPlans covers encryption, Lake Formation, and integrity gate playbooks", () => {
    const { buildFixPlans } = require("../aws-design-review/fix-assistant");
    const graph = {
      nodes: [
        { id: "s1", data: { blockType: "source", label: "S3", sourceType: "s3", endpoint: "s3://in/" } },
        { id: "t1", data: { blockType: "transform", label: "SQL", transformType: "spark_sql", sparkSql: "SELECT 1" } },
        { id: "o1", data: { blockType: "sink", label: "Gold", targetType: "s3", location: "s3://lake/gold/", sinkProvisioningMode: "provision", encryption: "AES256" } },
      ],
      edges: [
        { id: "e1", source: "s1", target: "t1" },
        { id: "e2", source: "t1", target: "o1" },
      ],
      pipelineMeta: { name: "mesh", domain: "commerce" },
    };
    const review = runDesignReview(graph);
    const encId = review.findings.find((f) => f.id.startsWith("setup.s3_encryption"))?.id
      || review.findings.find((f) => f.id.startsWith("sec.s3_encryption"))?.id;
    const ids = [encId, "sec.lake_formation", "sec.integrity_gate"].filter(Boolean);
    for (const id of ["sec.lake_formation", "sec.integrity_gate"]) {
      assert.ok(review.findings.some((f) => f.id === id), `expected finding ${id}`);
    }
    const plans = buildFixPlans({
      findings: review.findings,
      nodes: graph.nodes,
      pipelineMeta: graph.pipelineMeta,
      findingIds: ids,
    });
    assert.ok(plans.length >= 2);
    const byId = Object.fromEntries(plans.map((p) => [p.findingId, p]));
    assert.equal(byId["sec.lake_formation"].pipelineMetaPatch?.enableLakeFormation, true);
    assert.ok(byId["sec.integrity_gate"].steps.some((s) => /Integrity Gate/i.test(s)));
  });
});
