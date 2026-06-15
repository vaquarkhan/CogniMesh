"use strict";

const { runPvdmWorkload } = require("./services/pvdm-runtime");
const { runIntegrityGate } = require("./lib/integrity-gate");

exports.handler = async (event) => {
  if (event.contract && !event.source_rows) {
    const gate = runIntegrityGate(event.contract);
    if (!gate.passed) {
      return { outcome: "verification_failed", message: "Integrity gate failed", gate };
    }
    return {
      outcome: "committed",
      workload_id: event.workload_id || "design-check",
      message: "Integrity gate passed; invoke with source_rows for PVDM",
      gate,
    };
  }

  const contract = event.contract || event.workload?.contract;
  if (!contract) {
    return { outcome: "verification_failed", message: "Missing contract in payload" };
  }

  const gate = runIntegrityGate(contract);
  if (!gate.passed) {
    return { outcome: "verification_failed", message: "Integrity gate failed", errors: gate.errors };
  }

  return runPvdmWorkload({
    contract,
    source_rows: event.source_rows || [],
    workload_id: event.workload_id || `wl-${Date.now()}`,
    resume_offset: event.resume_offset || 0,
  });
};
