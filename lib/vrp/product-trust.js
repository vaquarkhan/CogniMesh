"use strict";

const { proofSla } = require("./proof-sla");

/**
 * Marketplace trust card: OpenMetadata/DataHub-style quality signal, bound to PVDM proof
 * rather than job-success logs. Complements Polaris/Glue discovery with content integrity.
 */
function productTrust(input = {}) {
  const {
    proofGated = false,
    vrpVerdict = null,
    conformanceProfile = null,
    profileTCertified = false,
    icebergSnapshotId = null,
    sourceSnapshotId = null,
    schemaFingerprint = null,
    lastProofAt = null,
    slaHours = undefined,
  } = input;

  let score = 0;
  const badges = [];

  if (proofGated && vrpVerdict === "PASS") {
    score += 40;
    badges.push("VRP_PASS");
  } else if (proofGated) {
    badges.push("VRP_GATED");
  }

  if (conformanceProfile === "A") {
    score += 20;
    badges.push("PROFILE_A");
  } else if (conformanceProfile === "T" && profileTCertified) {
    score += 20;
    badges.push("PROFILE_T");
  } else if (conformanceProfile === "O") {
    score += 15;
    badges.push("PROFILE_O");
  } else if (conformanceProfile === "T-uncertified") {
    badges.push("PROFILE_T_UNCERTIFIED");
  }

  if (icebergSnapshotId) {
    score += 15;
    badges.push("SNAPSHOT_PIN");
  }
  if (sourceSnapshotId) {
    score += 15;
    badges.push("SOURCE_SNAPSHOT");
  }
  if (schemaFingerprint) {
    score += 10;
    badges.push("SCHEMA_BOUND");
  }

  const sla = proofSla({ lastProofAt, slaHours });
  if (sla.fresh && vrpVerdict === "PASS") {
    score += 5;
    badges.push("SLA_FRESH");
  } else if (sla.stale) {
    badges.push("SLA_STALE");
  }
  score = Math.min(100, score);
  const grade = score >= 80 ? "A" : score >= 55 ? "B" : score >= 30 ? "C" : "D";
  return {
    score,
    grade,
    badges,
    proofGated: Boolean(proofGated),
    vrpVerdict: vrpVerdict || null,
    conformanceProfile: conformanceProfile || null,
    icebergSnapshotId: icebergSnapshotId || null,
    sourceSnapshotId: sourceSnapshotId || null,
    schemaFingerprint: schemaFingerprint || null,
    lastProofAt: lastProofAt || null,
    sla,
  };
}

function trustFromProof(proof = {}, extras = {}) {
  return productTrust({
    proofGated: true,
    vrpVerdict: proof.verdict,
    conformanceProfile: proof.conformance_profile,
    profileTCertified: proof.profile_t_certified,
    icebergSnapshotId: proof.commit_receipt?.iceberg_snapshot_id || proof.iceberg_snapshot_id,
    sourceSnapshotId: proof.source_snapshot_id,
    schemaFingerprint: proof.schema_fingerprint,
    lastProofAt: proof.signed_at || proof.commit_receipt?.committed_at,
    ...extras,
  });
}

module.exports = { productTrust, trustFromProof };
