"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generatePipelineTerraform,
  generateDrawioArchitecture,
} = require("../infrastructure-export");
const { runDesignReview } = require("../aws-design-review");

describe("infrastructure-export", () => {
  it("generates Terraform for provision-mode RDS sources", () => {
    const nodes = [
      {
        id: "s1",
        data: {
          blockType: "source",
          label: "Orders RDS",
          sourceType: "rds",
          rdsProvisioningMode: "provision",
          database: "orders_db",
          table: "orders",
        },
      },
    ];
    const result = generatePipelineTerraform({
      nodes,
      pipelineMeta: { name: "orders-pipeline", domain: "commerce", awsRegion: "eu-central-1" },
    });
    assert.equal(result.status, "success");
    assert.match(result.hcl, /aws_db_instance/);
    assert.match(result.hcl, /variable "aws_region"/);
    assert.match(result.hcl, /eu-central-1/);
    assert.match(result.hcl, /aws_secretsmanager_secret/);
    assert.match(result.hcl, /random_password/);
  });

  it("returns empty when RDS source uses existing mode", () => {
    const result = generatePipelineTerraform({
      nodes: [
        {
          id: "s1",
          data: {
            blockType: "source",
            sourceType: "rds",
            rdsProvisioningMode: "existing",
            database: "x",
            table: "y",
          },
        },
      ],
      pipelineMeta: { name: "x" },
    });
    assert.equal(result.status, "empty");
  });

  it("generates Terraform when RDS mode unset (defaults to provision)", () => {
    const result = generatePipelineTerraform({
      nodes: [
        { id: "s1", data: { blockType: "source", sourceType: "rds", database: "x", table: "y" } },
      ],
      pipelineMeta: { name: "x" },
    });
    assert.equal(result.status, "success");
    assert.match(result.hcl, /aws_db_instance/);
  });

  it("generates Terraform for provision S3 sink", () => {
    const result = generatePipelineTerraform({
      nodes: [
        {
          id: "o1",
          data: {
            blockType: "sink",
            targetType: "iceberg",
            sinkProvisioningMode: "provision",
            location: "s3://lake-gold/orders/",
            encryption: "AES256",
          },
        },
      ],
      pipelineMeta: { name: "orders", domain: "retail" },
    });
    assert.equal(result.status, "success");
    assert.match(result.hcl, /aws_s3_bucket/);
    assert.match(result.hcl, /lake-gold/);
  });

  it("generates draw.io mxfile XML", () => {
    const { xml, serviceCount } = generateDrawioArchitecture({
      topology: {
        services: [
          { id: "rds", type: "rds", label: "RDS", status: "ok" },
          { id: "glue", type: "glue", label: "Glue", status: "ok" },
        ],
        connections: [["rds", "glue"]],
      },
      pipelineMeta: { name: "mesh" },
    });
    assert.equal(serviceCount, 2);
    assert.match(xml, /<mxfile/);
    assert.match(xml, /RDS/);
  });
});

describe("aws-design-review RDS provisioning", () => {
  it("skips secrets critical when rdsProvisioningMode is provision", () => {
    const review = runDesignReview({
      nodes: [
        {
          id: "s1",
          data: {
            blockType: "source",
            sourceType: "rds",
            rdsProvisioningMode: "provision",
            database: "db",
            table: "t",
            label: "RDS",
          },
        },
        { id: "t1", data: { blockType: "transform", transformType: "spark_sql" } },
        { id: "k1", data: { blockType: "integrity_gate" } },
        { id: "o1", data: { blockType: "sink", location: "s3://lake/gold/" } },
      ],
      edges: [
        { source: "s1", target: "t1" },
        { source: "t1", target: "k1" },
        { source: "k1", target: "o1" },
      ],
      pipelineMeta: { name: "p", domain: "d" },
    });
    assert.equal(
      review.findings.some((f) => f.id.startsWith("sec.secrets_manager")),
      false
    );
  });

  it("guides existing RDS without secretArn (not critical)", () => {
    const review = runDesignReview({
      nodes: [
        {
          id: "s1",
          data: {
            blockType: "source",
            sourceType: "rds",
            rdsProvisioningMode: "existing",
            database: "db",
            table: "t",
          },
        },
        { id: "t1", data: { blockType: "transform", transformType: "spark_sql" } },
        { id: "k1", data: { blockType: "integrity_gate" } },
        { id: "o1", data: { blockType: "sink", location: "s3://lake/gold/" } },
      ],
      edges: [
        { source: "s1", target: "t1" },
        { source: "t1", target: "k1" },
        { source: "k1", target: "o1" },
      ],
      pipelineMeta: { name: "p", domain: "d" },
    });
    const finding = review.findings.find((f) => f.id.startsWith("setup.rds_secret"));
    assert.ok(finding);
    assert.equal(finding.severity, "medium");
    assert.equal(review.findings.some((f) => f.id.startsWith("sec.secrets_manager")), false);
  });
});
