#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { generateVRP } = require("../lib/vrp/generate");

async function main() {
  const outDir = path.join(__dirname, "..", "fixtures", "vrp-conformance");
  fs.mkdirSync(outDir, { recursive: true });

  const identityRows = [{ id: "1", amount: "10.00" }];
  const identityPass = await generateVRP(identityRows, identityRows, {
    identityFields: ["id"],
    contentFields: ["id", "amount"],
    pipelineRunId: "conformance-identity",
    parquetUri: "s3://fixture/identity.parquet",
    sinkFileDigest: { sha256: "fixture", row_count: "1" },
    icebergSnapshotId: "1001",
    sign: false,
  });
  const identityTampered = structuredClone(identityPass.proof);
  identityTampered.multiset.sink_hash = "0000000000000000000000000000000000000000000000000000000000000000";

  const sourceAgg = [
    { group: "east", id: "1", amount: "100.00" },
    { group: "west", id: "2", amount: "50.00" },
  ];
  const sinkAgg = [
    { group: "east", amount: "100.00" },
    { group: "west", amount: "50.00" },
  ];
  const pvdmSpec = {
    vrp: {
      mode: "aggregate",
      groupBy: ["group"],
      amountField: "amount",
      feeMultiplier: "1",
      moneyFields: ["amount"],
    },
  };
  const aggregatePass = await generateVRP(sourceAgg, sinkAgg, {
    pvdmSpec,
    pipelineRunId: "conformance-aggregate",
    icebergSnapshotId: "2001",
    sign: false,
  });
  const aggregateTampered = structuredClone(aggregatePass.proof);
  const inv = aggregateTampered.transform_verification.invariants.find((c) => c.id === "derived_sum");
  if (inv) inv.pass = false;

  const write = (name, proof) =>
    fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(proof, null, 2)}\n`, "utf8");

  write("identity-pass.json", identityPass.proof);
  write("identity-tampered.json", identityTampered);
  write("aggregate-pass.json", aggregatePass.proof);
  write("aggregate-tampered.json", aggregateTampered);
  console.log(`Wrote conformance fixtures to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
