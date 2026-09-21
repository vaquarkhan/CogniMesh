#!/usr/bin/env node
"use strict";

process.env.VRP_SIGN_ON_GENERATE = "false";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { generateVRP } = require("../vrp/generate");
const { diffProofs } = require("../vrp/proof-diff");
const { proofSla } = require("../vrp/proof-sla");
const { verifyVrpProof } = require("../vrp/verify");

describe("proof diff, SLA, and consumer verify", () => {
  it("diffProofs is identical for the same publication and flags a mutation", async () => {
    const rows = [{ id: "1", v: 1 }];
    const mutated = [{ id: "1", v: 99 }];
    const a = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sourceSnapshotId: "src-1",
      sign: false,
    });
    const b = await generateVRP(rows, mutated, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sourceSnapshotId: "src-1",
      sign: false,
    });
    const same = diffProofs(a.proof, a.proof);
    assert.equal(same.identical, true);
    const delta = diffProofs(a.proof, b.proof);
    assert.equal(delta.identical, false);
    assert.ok(delta.changes.some((c) => c.field === "verdict" || c.field === "multiset.sink_hash"));
  });

  it("proofSla is fresh inside the window and stale after", () => {
    const fresh = proofSla({ lastProofAt: new Date().toISOString(), slaHours: 24 });
    assert.equal(fresh.fresh, true);
    assert.equal(fresh.status, "fresh");
    const stale = proofSla({ lastProofAt: "2020-01-01T00:00:00.000Z", slaHours: 24 });
    assert.equal(stale.stale, true);
    assert.equal(stale.status, "stale");
  });

  it("consumer can verify an unsigned PASS proof offline", async () => {
    const rows = [{ id: "1", v: 1 }];
    const vrp = await generateVRP(rows, rows, {
      identityFields: ["id"],
      contentFields: ["id", "v"],
      sourceSnapshotId: "src-verify",
      sign: false,
    });
    const result = verifyVrpProof(vrp.proof, { requireSignature: false, requireSnapshotPin: false });
    assert.equal(result.valid, true, result.reason);
  });
});
