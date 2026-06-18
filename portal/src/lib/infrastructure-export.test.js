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

  it("exports drawio xml", () => {
    const { xml } = generateDrawioArchitecture({
      topology: { services: [{ id: "a", label: "S3", status: "ok" }], connections: [] },
      pipelineMeta: { name: "test" },
    });
    expect(xml).toContain("mxfile");
  });
});
