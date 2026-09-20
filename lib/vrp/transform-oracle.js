"use strict";

const { hashMultiset } = require("./multiset");

class TransformNotVerifiable extends Error {
  constructor(message) {
    super(message);
    this.name = "TransformNotVerifiable";
    this.code = "PROFILE_T_REFUSED";
  }
}

function distinct(a, b) {
  return Boolean(a) && Boolean(b) && String(a) !== String(b);
}

/**
 * Paper N8 / N16 / Profile T: transforming stages MUST verify against an independent oracle.
 * Same-implementation self-comparison is write-fidelity only and MUST NOT be certified.
 * N16: independence MUST come from distinct attestor identities and distinct code artifacts;
 * a self-declared implementation identifier MUST NOT be treated as independence.
 */
function verifyTransformOracle({
  producedRows,
  independentRows,
  producerImplId,
  independentImplId,
  producerAttestorId,
  independentAttestorId,
  producerArtifactDigest,
  independentArtifactDigest,
  vrpKey,
  fieldTypes,
}) {
  if (!distinct(producerAttestorId, independentAttestorId)) {
    throw new TransformNotVerifiable(
      "Profile T requires signed attestations from distinct attestor identities (paper N16)"
    );
  }
  if (!distinct(producerArtifactDigest, independentArtifactDigest)) {
    throw new TransformNotVerifiable(
      "Profile T requires distinct code artifacts; a self-declared identifier is not independence (paper N16)"
    );
  }
  if (producerImplId && independentImplId && producerImplId === independentImplId) {
    throw new TransformNotVerifiable(
      "same implementation on both sides proves write-fidelity, not compute-correctness"
    );
  }
  const hashOpts = vrpKey || fieldTypes ? { vrpKey, fieldTypes } : {};
  const produced = hashMultiset(producedRows, null, hashOpts);
  const independent = hashMultiset(independentRows, null, hashOpts);
  return {
    verdict: produced === independent ? "PASS" : "FAIL",
    profile_t_certified: produced === independent,
    producer_digest: produced,
    independent_digest: independent,
    producer_attestor_id: producerAttestorId,
    independent_attestor_id: independentAttestorId,
    producer_artifact_digest: producerArtifactDigest,
    independent_artifact_digest: independentArtifactDigest,
  };
}

function resolveConformanceProfile(pvdmSpec = {}, options = {}) {
  const mode = pvdmSpec.vrp?.mode || pvdmSpec.vrpMode || "identity";
  const requested = options.conformanceProfile || pvdmSpec.vrp?.profile || pvdmSpec.profile;
  if (
    requested === "O" ||
    pvdmSpec.vrp?.ordered ||
    pvdmSpec.ordered ||
    pvdmSpec.vrp?.sequenceField ||
    pvdmSpec.sequenceField
  ) {
    return { profile: "O", profile_t_certified: false };
  }
  if (mode === "identity") {
    return { profile: "A", profile_t_certified: false };
  }
  if (requested === "T" || requested === "profile-t") {
    const oracle = verifyTransformOracle({
      producedRows: options.sinkRows || [],
      independentRows: options.independentRows || [],
      producerImplId: options.producerImplId || pvdmSpec.vrp?.producerImplId,
      independentImplId: options.independentImplId || pvdmSpec.vrp?.independentImplId,
      producerAttestorId: options.producerAttestorId || pvdmSpec.vrp?.producerAttestorId,
      independentAttestorId: options.independentAttestorId || pvdmSpec.vrp?.independentAttestorId,
      producerArtifactDigest: options.producerArtifactDigest || pvdmSpec.vrp?.producerArtifactDigest,
      independentArtifactDigest: options.independentArtifactDigest || pvdmSpec.vrp?.independentArtifactDigest,
      vrpKey: options.vrpKey,
      fieldTypes: options.fieldTypes || pvdmSpec.fieldTypes || pvdmSpec.vrp?.fieldTypes,
    });
    return { profile: "T", ...oracle };
  }
  return {
    profile: "T-uncertified",
    profile_t_certified: false,
    reason:
      "aggregate/transform stage used producer-side invariants only; Profile T certification requires distinct attestors and artifacts (paper N8/N16)",
  };
}

module.exports = {
  TransformNotVerifiable,
  verifyTransformOracle,
  resolveConformanceProfile,
};
