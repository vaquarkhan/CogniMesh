import { describe, it, expect } from "vitest";
import { getPatternById, instantiatePattern } from "./pipeline-patterns";
import { MESH_DOMAIN_BRANCHES, VAQUAR_MESH_ACCOUNTS } from "./patterns/mesh-constants";

describe("datamesh patterns", () => {
  it("multi-domain pattern has 3 producer branches with distinct AC + region", () => {
    const pattern = getPatternById("arch-datamesh-multi-domain");
    const inst = instantiatePattern(pattern);
    const branchNodes = inst.nodes.filter((n) => n.data.meshBranch);
    const branches = new Set(branchNodes.map((n) => n.data.meshBranch));
    expect(branches.size).toBe(3);
    expect(branches.has("orders")).toBe(true);
    expect(branches.has("inventory")).toBe(true);
    expect(branches.has("customers")).toBe(true);

    expect(inst.nodes.find((n) => n.data.label === "Orders RDS")?.data.meshAccount).toBe(
      MESH_DOMAIN_BRANCHES.orders.accountId
    );
    expect(inst.nodes.find((n) => n.data.label === "Inventory Kafka")?.data.meshRegion).toBe(
      MESH_DOMAIN_BRANCHES.inventory.region
    );
    expect(inst.pipelineMeta.meshAccounts).toEqual(VAQUAR_MESH_ACCOUNTS);
  });

  it("domain product uses producer / steward / publisher roles on nodes", () => {
    const inst = instantiatePattern(getPatternById("arch-datamesh-domain-product"));
    expect(inst.nodes.find((n) => n.data.label === "PVDM Gate")?.data.meshRole).toBe("steward");
    expect(inst.nodes.find((n) => n.data.label === "Iceberg Product")?.data.meshAccount).toBe(
      VAQUAR_MESH_ACCOUNTS.publisher
    );
    expect(inst.nodes.find((n) => n.data.label === "Bronze Landing")?.data.meshAccount).toBe(
      VAQUAR_MESH_ACCOUNTS.producer
    );
  });
});
