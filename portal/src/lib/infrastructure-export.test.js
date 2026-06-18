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
