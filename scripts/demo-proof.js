#!/usr/bin/env node
"use strict";

/**
 * 60-second demo: produce a fresh VRP and verify it offline.
 * Usage: node scripts/demo-proof.js
 */
process.env.VRP_SIGN_ON_GENERATE = process.env.VRP_SIGN_ON_GENERATE || "false";
process.env.GLUE_ICEBERG_ENABLED = "false";

const fs = require("fs");
const path = require("path");
const { runPvdmWorkload } = require("../services/pvdm-runtime");
const { verifyVrpProof } = require("../lib/vrp/verify");

async function main() {
  const contract = {
    metadata: { name: "demo-orders", domain: "commerce" },
    spec: {
      transform: { pvdm: { identityFields: ["id"], contentFields: ["id", "amount"] } },
      target: {
        location: "s3://demo-bucket/gold/",
        catalog: { database: "commerce", table: "orders_gold" },
      },
    },
  };

  const result = await runPvdmWorkload({
    contract,
    source_rows: [
      { id: "o1", amount: 100 },
      { id: "o2", amount: 250 },
    ],
    workload_id: `demo-proof-${Date.now()}`,
  });

  if (result.outcome !== "committed" || !result.proof) {
    console.error(JSON.stringify({ ok: false, outcome: result.outcome, error: result.error }, null, 2));
    process.exit(1);
  }

  const outPath = path.join(process.cwd(), ".demo-proof.json");
  fs.writeFileSync(outPath, `${JSON.stringify(result.proof, null, 2)}\n`);

  const verification = verifyVrpProof(result.proof, { requireSignature: false });
  const summary = {
    ok: verification.valid,
    verdict: result.proof.verdict,
    proof_id: result.proof.proof_id,
    iceberg_snapshot_id: result.proof.iceberg_snapshot_id,
    source_hash: result.proof.multiset?.source_hash?.slice(0, 16) + "…",
    sink_hash: result.proof.multiset?.sink_hash?.slice(0, 16) + "…",
    written: outPath,
    verify: verification.valid
      ? "PASS — source and sink hashes match on declared fields"
      : verification.reason,
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nOffline verify:\n  npx cognimesh-verify ${outPath}`);
  process.exit(verification.valid ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
