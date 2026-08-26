"use strict";

const { hashMultiset } = require("./multiset");

class TransformNotVerifiable extends Error {
  constructor(message) {
    super(message);
    this.name = "TransformNotVerifiable";
    this.code = "PROFILE_T_REFUSED";
  }
}

/**
 * Paper N8 / Profile T: transforming stages MUST verify against an independent oracle.
 * Same-implementation self-comparison is write-fidelity only and MUST NOT be certified.
 */
function verifyTransformOracle({
  producedRows,
  independentRows,
  producerImplId,
  independentImplId,
  vrpKey,
}) {
  if (!producerImplId || !independentImplId) {
    throw new TransformNotVerifiable(
      "Profile T requires an independent implementation or authenticated upstream digest"
    );
  }
  if (producerImplId === independentImplId) {
    throw new TransformNotVerifiable(
      "same implementation on both sides proves write-fidelity, not compute-correctness"
    );
  }
  const produced = hashMultiset(producedRows, null, vrpKey ? { vrpKey } : {});
  const independent = hashMultiset(independentRows, null, vrpKey ? { vrpKey } : {});
  return {
    verdict: produced === independent ? "PASS" : "FAIL",
    profile_t_certified: produced === independent,
    producer_digest: produced,
    independent_digest: independent,
  };
}

function resolveConformanceProfile(pvdmSpec = {}, options = {}) {
  const mode = pvdmSpec.vrp?.mode || pvdmSpec.vrpMode || "identity";
  if (mode === "identity") {
    return { profile: "A", profile_t_certified: false };
  }
  const requested = options.conformanceProfile || pvdmSpec.vrp?.profile || pvdmSpec.profile;
  if (requested === "T" || requested === "profile-t") {
    const oracle = verifyTransformOracle({
      producedRows: options.sinkRows || [],
      independentRows: options.independentRows || [],
      producerImplId: options.producerImplId || pvdmSpec.vrp?.producerImplId,
      independentImplId: options.independentImplId || pvdmSpec.vrp?.independentImplId,
      vrpKey: options.vrpKey,
    });
    return { profile: "T", ...oracle };
  }
  return {
    profile: "T-uncertified",
    profile_t_certified: false,
    reason:
      "aggregate/transform stage used producer-side invariants only; Profile T certification requires an independent oracle (paper N8)",
  };
}

module.exports = {
  TransformNotVerifiable,
  verifyTransformOracle,
  resolveConformanceProfile,
};
