#!/usr/bin/env node
"use strict";

/**
 * End-to-end test: graph → contract → validate → compile → deploy API
 */
const { graphToContract, validateContract } = require("../lib/contract-builder");

const nodes = [
  {
    id: "s1",
    data: {
      blockType: "source",
      sourceType: "rds",
      database: "orders_db",
      table: "orders",
      cdcEnabled: true,
      primaryKey: "order_id",
    },
  },
  {
    id: "t1",
    data: {
      blockType: "transform",
      transformType: "spark_sql",
      executionMode: "batch",
      sparkSql: "SELECT * FROM bronze.orders",
    },
  },
  {
    id: "k1",
    data: {
      blockType: "sink",
      targetType: "iceberg",
      location: "s3://cognimesh-dev-gold/orders/",
      catalogDatabase: "commerce_gold",
      catalogTable: "orders",
    },
  },
];

const edges = [
  { source: "s1", target: "t1" },
  { source: "t1", target: "k1" },
];

const pipelineMeta = { name: "e2e-test-pipeline", domain: "commerce", version: "1.0.0", ownerEmail: "test@example.com" };

console.log("1. Graph → DataContract");
const { success, contract, errors } = graphToContract(nodes, edges, pipelineMeta);
if (!success) {
  console.error("FAIL:", errors);
  process.exit(1);
}
console.log(`   ✓ ${contract.metadata.name}@${contract.metadata.version} (pattern: ${contract.spec.execution.pattern})`);

console.log("2. Schema validation");
const validation = validateContract(contract);
if (!validation.valid) {
  console.error("FAIL:", validation.errors);
  process.exit(1);
}
console.log("   ✓ valid");

console.log("3. Step Functions compile (Vaquar PVDM)");
const { compileContractSmart } = require("../services/pipeline-engine/compile");
const compiled = compileContractSmart(contract);
if (compiled.pattern !== "vaquar-pvdm") {
  console.error("FAIL: expected vaquar-pvdm pattern, got", compiled.pattern);
  process.exit(1);
}
const sm = compiled.stateMachine;
if (!sm.States.IntegrityGate || !sm.States.InvokeDomainWriter) {
  console.error("FAIL: missing Vaquar PVDM states");
  process.exit(1);
}
console.log(`   ✓ ${sm.StartAt} → … → ${Object.keys(sm.States).length} states`);

console.log("4. Integrity gate (Vaquar rules engine)");
const { runIntegrityGate } = require("../lib/integrity-gate");
const gate = runIntegrityGate(contract);
if (!gate.passed) {
  console.error("FAIL:", gate.errors);
  process.exit(1);
}
console.log(`   ✓ ${gate.passedRules.length} rules passed`);

console.log("\n✓ E2E pipeline generation passed");
