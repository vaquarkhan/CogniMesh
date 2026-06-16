"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeStateMachineForAws } = require("../stepfunctions-deploy");

describe("sanitizeStateMachineForAws", () => {
  it("strips top-level cognimesh metadata before AWS deploy", () => {
    const asl = {
      Comment: "test",
      StartAt: "A",
      States: { A: { Type: "Pass", End: true } },
      cognimesh: { mode: "workflow-graph", nodeCount: 3 },
    };
    const clean = sanitizeStateMachineForAws(asl);
    assert.deepEqual(clean, {
      Comment: "test",
      StartAt: "A",
      States: { A: { Type: "Pass", End: true } },
    });
    assert.ok(!("cognimesh" in clean));
  });

  it("strips nested cognimesh keys anywhere in the tree", () => {
    const asl = {
      StartAt: "A",
      States: {
        A: {
          Type: "Pass",
          cognimesh: { nodeId: "n1" },
          End: true,
        },
      },
      cognimesh: { pattern: "vaquar-pvdm" },
    };
    const clean = sanitizeStateMachineForAws(asl);
    assert.deepEqual(clean.States.A, { Type: "Pass", End: true });
    assert.ok(!("cognimesh" in clean));
  });
});
