#!/usr/bin/env node
"use strict";

const { runIntegrityGate } = require("../lib/integrity-gate");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

const contractPath = process.argv[2] || "contracts/examples/structured-cdc-pipeline.yaml";
const raw = fs.readFileSync(path.resolve(contractPath), "utf8");
const contract = yaml.load(raw);

const result = runIntegrityGate(contract);

console.log(`Integrity gate: ${result.passed ? "PASS" : "FAIL"}`);
console.log(`Pattern: ${result.pattern}`);
if (result.passedRules.length) {
  console.log(`Passed rules: ${result.passedRules.join(", ")}`);
}
if (result.errors.length) {
  console.error("Errors:");
  for (const e of result.errors) console.error(`  [${e.ruleId}] ${e.message || e.field}`);
}
if (result.warnings.length) {
  console.warn("Warnings:");
  for (const w of result.warnings) console.warn(`  [${w.ruleId}] ${w.message || w.field}`);
}

process.exit(result.passed ? 0 : 1);
