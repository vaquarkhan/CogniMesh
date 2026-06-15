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
  it("flags missing Secrets Manager on RDS", () => {
    const review = runDesignReview(RDS_GRAPH);
    assert.ok(review.security.findings.some((f) => f.id === "sec.secrets_manager"));
    assert.ok(review.security.score < 100);
    assert.ok(review.topology.services.some((s) => s.id === "rds"));
  });

  it("passes RDS with secret ARN and gate", () => {
    const graph = {
      ...RDS_GRAPH,
      nodes: RDS_GRAPH.nodes.map((n) =>
        n.id === "s1"
          ? {
              ...n,
              data: {
                ...n.data,
                secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:orders-db",
                vpcSecurityGroup: "sg-abc",
              },
            }
          : n
      ),
    };
    const review = runDesignReview(graph);
    assert.equal(review.findings.some((f) => f.id === "sec.secrets_manager"), false);
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
});
