import { describe, it, expect } from "vitest";
import { generatePipelineTerraform, generateDrawioArchitecture } from "./infrastructure-export";

describe("infrastructure-export (portal)", () => {
  it("exports terraform for provision RDS", () => {
    const result = generatePipelineTerraform({
      nodes: [
        {
          id: "s1",
          data: {
            blockType: "source",
            sourceType: "mysql",
            rdsProvisioningMode: "provision",
            database: "crm",
            table: "customers",
          },
        },
      ],
      pipelineMeta: { name: "crm-sync", domain: "sales" },
    });
    expect(result.status).toBe("success");
    expect(result.hcl).toContain("aws_db_instance");
  });

  it("exports terraform for provision S3 sink", () => {
    const result = generatePipelineTerraform({
      nodes: [
        {
          id: "o1",
          data: {
            blockType: "sink",
            targetType: "iceberg",
            sinkProvisioningMode: "provision",
            encryption: "AES256",
            location: "s3://cognimesh-commerce-gold/orders/",
            catalogDatabase: "gold",
            catalogTable: "orders",
          },
        },
      ],
      pipelineMeta: { name: "orders", domain: "commerce" },
    });
    expect(result.status).toBe("success");
    expect(result.hcl).toContain("aws_s3_bucket");
    expect(result.hcl).toContain("cognimesh-commerce-gold");
  });

  it("exports drawio xml", () => {
    const { xml } = generateDrawioArchitecture({
      topology: { services: [{ id: "a", label: "S3", status: "ok" }], connections: [] },
      pipelineMeta: { name: "test" },
    });
    expect(xml).toContain("mxfile");
  });
});

describe("generateDrawioArchitecture - dynamic canvas rendering", () => {
  it("handles empty nodes gracefully with minimal diagram", () => {
    const { xml, serviceCount } = generateDrawioArchitecture({
      topology: {},
      nodes: [],
      pipelineMeta: { name: "empty-test" },
    });
    expect(xml).toContain("mxfile");
    expect(xml).toContain("No pipeline blocks on canvas");
    expect(serviceCount).toBe(2); // IGW + NAT minimum
  });

  it("handles undefined nodes gracefully", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      pipelineMeta: { name: "undef-test" },
    });
    expect(xml).toContain("mxfile");
    expect(xml).toContain("No pipeline blocks on canvas");
  });

  it("shows RDS + Secrets Manager when RDS source is present", () => {
    const { xml, serviceCount } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        {
          id: "s1",
          data: {
            blockType: "source",
            sourceType: "rds",
            rdsProvisioningMode: "provision",
            database: "orders_db",
            label: "Orders RDS",
          },
        },
      ],
      pipelineMeta: { name: "rds-only", domain: "commerce" },
    });
    expect(xml).toContain("mxfile");
    expect(xml).toContain("Orders RDS");
    expect(xml).toContain("Secrets Manager");
    expect(xml).not.toContain("Kinesis");
    expect(serviceCount).toBeGreaterThan(0);
  });

  it("shows Kinesis Data Streams when kinesis source exists", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        {
          id: "k1",
          data: {
            blockType: "source",
            sourceType: "kinesis",
            label: "Click Stream",
          },
        },
      ],
      pipelineMeta: { name: "kinesis-only" },
    });
    expect(xml).toContain("Kinesis Data Streams");
    expect(xml).toContain("Click Stream");
    // No RDS service box should appear (note: metadata footer has "0 RDS" which is fine)
    expect(xml).not.toContain("RDS:");
    expect(xml).not.toContain("Secrets Manager");
  });

  it("shows Integrity Gate + PVDM proof when integrity_gate block exists", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "g1", data: { blockType: "integrity_gate", label: "Quality Check" } },
      ],
      pipelineMeta: { name: "gate-test" },
    });
    expect(xml).toContain("Integrity Gate");
    expect(xml).toContain("PVDM Proof");
    expect(xml).toContain("LambdaExecRole");
  });

  it("shows Glue ETL when glue_etl transform exists", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "t1", data: { blockType: "transform", transformType: "glue_etl", label: "ETL Job" } },
      ],
      pipelineMeta: { name: "glue-test" },
    });
    expect(xml).toContain("Glue");
    expect(xml).toContain("GlueJobRole");
    expect(xml).toContain("sg-glue");
  });

  it("shows Firehose when passthrough with awsService=firehose exists", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "f1", data: { blockType: "passthrough", awsService: "firehose", label: "Delivery" } },
      ],
      pipelineMeta: { name: "firehose-test" },
    });
    expect(xml).toContain("Firehose");
    expect(xml).toContain("FirehoseDeliveryRole");
  });

  it("shows S3 sinks based on actual sink locations", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        {
          id: "o1",
          data: { blockType: "sink", targetType: "s3", label: "Raw Output" },
        },
        {
          id: "o2",
          data: { blockType: "sink", targetType: "iceberg", label: "Gold Table", catalogTable: "orders" },
        },
      ],
      pipelineMeta: { name: "sinks-test" },
    });
    expect(xml).toContain("Raw Output");
    expect(xml).toContain("Iceberg");
    expect(xml).toContain("Gold Table");
    expect(xml).toContain("Lake Formation");
    expect(xml).toContain("Glue Data Catalog");
  });

  it("only shows sinks - does not crash without sources or transforms", () => {
    const { xml, serviceCount } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "o1", data: { blockType: "sink", targetType: "s3", label: "Output" } },
      ],
      pipelineMeta: { name: "sink-only" },
    });
    expect(xml).toContain("mxfile");
    expect(xml).toContain("Output");
    expect(serviceCount).toBeGreaterThan(0);
    // Should NOT show Glue or Lambda when no transforms/gates
    expect(xml).not.toContain("Glue");
    expect(xml).not.toContain("Lambda");
  });

  it("renders mixed pipeline with RDS, Kinesis, Glue, Gate, and Iceberg", () => {
    const { xml, serviceCount } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "s1", data: { blockType: "source", sourceType: "rds", database: "crm", label: "CRM DB" } },
        { id: "s2", data: { blockType: "source", sourceType: "kinesis", label: "Events" } },
        { id: "t1", data: { blockType: "transform", transformType: "glue_etl", label: "ETL" } },
        { id: "g1", data: { blockType: "integrity_gate", label: "Gate" } },
        { id: "o1", data: { blockType: "sink", targetType: "iceberg", label: "Gold" } },
      ],
      pipelineMeta: { name: "full-pipeline", domain: "analytics", awsRegion: "eu-west-1" },
    });
    expect(xml).toContain("mxfile");
    expect(xml).toContain("eu-west-1");
    expect(xml).toContain("CRM DB");
    expect(xml).toContain("Kinesis Data Streams");
    expect(xml).toContain("Glue");
    expect(xml).toContain("Integrity Gate");
    expect(xml).toContain("Iceberg");
    expect(xml).toContain("Secrets Manager");
    expect(xml).toContain("Step Functions");
    expect(xml).toContain("KMS");
    expect(xml).toContain("sg-rds");
    expect(xml).toContain("sg-glue");
    expect(xml).toContain("sg-lambda");
    expect(xml).toContain("StreamConsumerRole");
    expect(serviceCount).toBeGreaterThanOrEqual(10);
  });

  it("shows security groups relevant to actual services used", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "s1", data: { blockType: "source", sourceType: "kinesis", label: "Stream" } },
        { id: "t1", data: { blockType: "transform", transformType: "glue_etl" } },
      ],
      pipelineMeta: { name: "sg-test" },
    });
    expect(xml).toContain("sg-glue");
    expect(xml).toContain("sg-streaming");
    expect(xml).not.toContain("sg-rds");
    expect(xml).not.toContain("sg-lambda");
  });

  it("shows IAM roles only for services that are present", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "o1", data: { blockType: "sink", targetType: "s3", label: "Output" } },
      ],
      pipelineMeta: { name: "iam-test" },
    });
    expect(xml).toContain("LakeFormationAdmin");
    expect(xml).not.toContain("GlueJobRole");
    expect(xml).not.toContain("LambdaExecRole");
    expect(xml).not.toContain("StreamConsumerRole");
  });

  it("shows VPC existing mode when configured", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [{ id: "s1", data: { blockType: "source", sourceType: "s3", label: "Landing" } }],
      pipelineMeta: { name: "vpc-test", vpcMode: "existing", vpcId: "vpc-abc123" },
    });
    expect(xml).toContain("VPC (existing)");
    expect(xml).toContain("vpc-abc123");
  });

  it("produces valid XML structure", () => {
    const { xml } = generateDrawioArchitecture({
      topology: {},
      nodes: [
        { id: "s1", data: { blockType: "source", sourceType: "rds", label: "DB" } },
        { id: "t1", data: { blockType: "transform", transformType: "glue_etl" } },
        { id: "o1", data: { blockType: "sink", targetType: "iceberg", label: "Gold" } },
      ],
      pipelineMeta: { name: "xml-test" },
    });
    expect(xml).toMatch(/^<\?xml version="1.0"/);
    expect(xml).toContain("<mxfile");
    expect(xml).toContain("</mxfile>");
    expect(xml).toContain("<diagram");
    expect(xml).toContain("</diagram>");
    expect(xml).toContain("<root>");
    expect(xml).toContain("</root>");
  });
});
