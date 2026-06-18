import { describe, it, expect } from "vitest";
import { syncNodeIdCounter, createNodeIdFactory } from "./node-id";

describe("node-id", () => {
  it("syncNodeIdCounter finds max node-N id", () => {
    expect(syncNodeIdCounter([{ id: "node-3" }, { id: "node-10" }, { id: "x" }])).toBe(10);
  });

  it("createNodeIdFactory avoids duplicates after sync", () => {
    const factory = createNodeIdFactory();
    factory.sync([{ id: "node-5" }]);
    expect(factory.next()).toBe("node-6");
  });
});
