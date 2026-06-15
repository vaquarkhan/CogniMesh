"use strict";

const { runIntegrityGate } = require("./lib/integrity-gate");
const { validateContract } = require("./lib/contract-builder/validate");

exports.handler = async (event) => {
  const contract = event.contract || event;
  const schema = validateContract(contract);
  if (!schema.valid) {
    return {
      passed: false,
      stage: "schema",
      errors: schema.errors,
    };
  }

  const gate = runIntegrityGate(contract);
  return {
    passed: gate.passed,
    stage: "integrity_gate",
    pattern: gate.pattern,
    passedRules: gate.passedRules,
    errors: gate.errors,
    warnings: gate.warnings,
  };
};
