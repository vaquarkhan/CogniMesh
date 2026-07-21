#!/usr/bin/env node
"use strict";

/**
 * Mock PVDM workload against the Node runtime (local) or print AWS invoke tips.
 *
 * Usage:
 *   node scripts/run-pvdm-mock-workload.js
 *   node scripts/run-pvdm-mock-workload.js --resume-demo
 *   node scripts/run-pvdm-mock-workload.js --rows 12 --chunk-size 5
 */

process.env.VRP_SIGN_ON_GENERATE = process.env.VRP_SIGN_ON_GENERATE || "false";
process.env.ICEBERG_SNAPSHOT_STATE =
  process.env.ICEBERG_SNAPSHOT_STATE ||
  require("path").join(require("os").tmpdir(), `iceberg-mock-${process.pid}.json`);

const { runPvdmWorkload, IceGuardWriter } = require("../services/pvdm-runtime");
const { compileVaquarStateMachine } = require("../lib/vaquar/pvdm-sfn");

function parseArgs(argv) {
  const opts = { rows: 8, chunkSize: 3, resumeDemo: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--rows") opts.rows = Number(argv[++i]) || opts.rows;
    else if (argv[i] === "--chunk-size") opts.chunkSize = Number(argv[++i]) || opts.chunkSize;
    else if (argv[i] === "--resume-demo") opts.resumeDemo = true;
  }
  return opts;
}

function sampleContract(chunkSize) {
  return {
    apiVersion: "cognimesh.io/v1",
    kind: "DataContract",
    metadata: {
      name: "mock-pvdm-orders",
      domain: "commerce",
      version: "1.0.0",
    },
    spec: {
      execution: { mode: "batch", pattern: "vaquar" },
      source: { type: "rds" },
      transform: {
        type: "spark_sql",
        pvdm: {
          identityFields: ["order_id"],
          contentFields: ["order_id", "amount"],
          maxChunkRecords: chunkSize,
          rollbackThresholdMs: 30000,
        },
      },
      target: {
        type: "iceberg",
        location: "s3://cognimesh-mock-staging/orders/",
        catalog: { database: "commerce_gold", table: "orders_mock" },
      },
    },
  };
}

function sampleRows(n) {
  return Array.from({ length: n }, (_, i) => ({
    order_id: `ord-${String(i + 1).padStart(4, "0")}`,
    amount: (i + 1) * 10.5,
  }));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const contract = sampleContract(opts.chunkSize);
  const source_rows = sampleRows(opts.rows);

  console.log("CogniMesh mock PVDM workload");
  console.log(`  rows=${opts.rows} chunkSize=${opts.chunkSize}`);

  if (opts.resumeDemo) {
    const writer = new IceGuardWriter({
      isolationId: "mock-resume",
      getRemainingMs: () => 5000,
      rollbackThresholdMs: 30000,
    });
    try {
      await writer.writeChunk(0, source_rows.slice(0, opts.chunkSize), contract.spec.target.location);
      console.error("expected IceGuard timeout abort");
      process.exitCode = 1;
      return;
    } catch (err) {
      console.log(`  IceGuard abort: ${err.message}`);
    }
  }

  const first = await runPvdmWorkload({
    contract,
    source_rows,
    workload_id: `mock-${Date.now()}`,
    resume_offset: 0,
  });
  console.log(`  outcome=${first.outcome} chunks=${first.chunks} vrp=${first.vrp_verdict}`);
  if (first.snapshot_id) console.log(`  snapshot_id=${first.snapshot_id}`);
  if (first.message) console.log(`  message=${first.message}`);

  const sm = compileVaquarStateMachine(contract, {
    accountId: process.env.AWS_ACCOUNT_ID || "123456789012",
    region: process.env.AWS_REGION || "us-east-1",
    namePrefix: process.env.AWS_NAME_PREFIX || "cognimesh-dev",
  });
  console.log(`  SFN StartAt=${sm.StartAt} resume wired=${Boolean(sm.States.IncrementResumeAttempt)}`);

  if (process.env.AWS_DEPLOY_ENABLED === "true") {
    console.log("\nAWS tips:");
    console.log("  1. npm run package:domain-writer && npm run package:integrity-gate");
    console.log("  2. Deploy Lambdas + state machine from Terraform / portal Deploy");
    console.log("  3. Start execution with Payload: { contract, source_rows, resume_offset: 0 }");
  } else {
    console.log("\nLocal only (set AWS_DEPLOY_ENABLED=true after Terraform for live SFN).");
    console.log("See docs/examples/aws-pvdm-runbook.md");
  }

  if (first.outcome !== "committed" && first.outcome !== "unverified") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
