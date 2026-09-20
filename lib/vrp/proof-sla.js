"use strict";

/**
 * Proof freshness SLA. OpenMetadata freshness is wall-clock since ingest;
 * CogniMesh freshness is hours since the last VRP PASS.
 */
function proofSla(input = {}) {
  const slaHours = Number(input.slaHours || process.env.PVDM_PROOF_SLA_HOURS || 24);
  const lastProofAt = input.lastProofAt || input.signedAt || input.committedAt || null;
  if (!lastProofAt) {
    return {
      slaHours,
      lastProofAt: null,
      ageHours: null,
      fresh: false,
      stale: true,
      status: "unknown",
      label: "No VRP PASS on record",
    };
  }
  const ts = new Date(lastProofAt).getTime();
  if (Number.isNaN(ts)) {
    return {
      slaHours,
      lastProofAt,
      ageHours: null,
      fresh: false,
      stale: true,
      status: "unknown",
      label: "Invalid proof timestamp",
    };
  }
  const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
  const fresh = ageHours <= slaHours;
  const status = fresh ? "fresh" : "stale";
  const label = fresh
    ? `Fresh (${Math.max(0, Math.round(ageHours))}h ago, SLA ${slaHours}h)`
    : `STALE (${Math.round(ageHours / 24)}d since last VRP PASS, SLA ${slaHours}h)`;
  return {
    slaHours,
    lastProofAt,
    ageHours,
    fresh,
    stale: !fresh,
    status,
    label,
  };
}

module.exports = { proofSla };
