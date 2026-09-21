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

/** Auditable trust-score rubric (points sum → grade). Featured prefers score ≥ 55 (grade B). */
const TRUST_RUBRIC = {
  version: "1",
  maxScore: 100,
  grades: [
    { grade: "A", minScore: 80, meaning: "VRP PASS + profile + pins + schema (+ freshness)" },
    { grade: "B", minScore: 55, meaning: "Proof-gated PASS with partial pins — featured threshold" },
    { grade: "C", minScore: 30, meaning: "Gated or partial signals only" },
    { grade: "D", minScore: 0, meaning: "Insufficient proof signals" },
  ],
  points: [
    { id: "VRP_PASS", points: 40, when: "proofGated && vrpVerdict === PASS" },
    { id: "PROFILE_A_or_T", points: 20, when: "conformanceProfile A, or T when certified" },
    { id: "PROFILE_O", points: 15, when: "conformanceProfile O (observational)" },
    { id: "SNAPSHOT_PIN", points: 15, when: "icebergSnapshotId present" },
    { id: "SOURCE_SNAPSHOT", points: 15, when: "sourceSnapshotId present" },
    { id: "SCHEMA_BOUND", points: 10, when: "schemaFingerprint present" },
    { id: "SLA_FRESH", points: 5, when: "proof within SLA window && VRP PASS" },
  ],
  featured: {
    minScore: 55,
    requireFresh: true,
    note: "Featured excludes SLA_STALE products; falls back to top-by-trust if none qualify",
  },
  gradeBtoA: {
    needPoints: "reach ≥ 80",
    typical:
      "VRP_PASS (40) + PROFILE_A (20) = 60 (grade B). Add SNAPSHOT_PIN (15) + SCHEMA_BOUND (10) + SLA_FRESH (5) → 90 (grade A).",
  },
};

module.exports = { productTrust, trustFromProof, TRUST_RUBRIC };
