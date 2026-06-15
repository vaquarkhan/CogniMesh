#!/usr/bin/env node
"use strict";

const { runPvdmWorkload, generateVRP, validateThenCommit } = require("../services/pvdm-runtime");

const contract = {
  apiVersion: "cognimesh.io/v1",
  kind: "DataContract",
  metadata: { name: "pvdm-test", domain: "commerce", version: "1.0.0" },
  spec: {
    source: { type: "rds" },
    transform: {
      type: "spark_sql",
      sparkRules: { enabled: true },
      pvdm: {
        identityFields: ["order_id"],
        contentFields: ["order_id", "amount"],
      },
    },
    target: {
      type: "iceberg",
      location: "s3://cognimesh-gold/test/",
      catalog: { database: "commerce_gold", table: "orders" },
    },
    execution: { pattern: "vaquar", mode: "batch" },
  },
};

const rows = [
  { order_id: "1", amount: 100 },
  { order_id: "2", amount: 200 },
];

(async () => {
  console.log("1. VRP PASS");
  const vrp = generateVRP(rows, rows, ["order_id"], ["order_id", "amount"]);
  if (vrp.verdict !== "PASS") throw new Error("VRP should pass");
  validateThenCommit(vrp);
  console.log("   ok");

  console.log("2. PVDM workload");
  const result = await runPvdmWorkload({ contract, source_rows: rows, workload_id: "test-wl" });
  if (result.outcome !== "committed") {
    console.error(result);
    throw new Error("PVDM should commit");
  }
  console.log(`   outcome=${result.outcome} chunks=${result.chunks}`);

  console.log("\nPVDM runtime tests passed");
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
