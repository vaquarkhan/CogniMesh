"use strict";

const crypto = require("crypto");
const { canonicalJson, sha256Canonical } = require("./canonical");
const { signProofPayload, proofValidityWindow } = require("./sign");
const {
  verifyVrpProof,
  verifyProofSignature,
  verifyProofValidity,
} = require("./verify");
const { resolveGatewayInputs, ProofGatewayError } = require("./proof-gateway");

function normalizeInputBinding(proof, gatewayStamp = null) {
  return {
    proof_version: proof.proof_version,
    pipeline_run_id: proof.pipeline_run_id,
    chunk_sequence: proof.chunk_sequence,
    table: proof.table,
    schema_fingerprint: proof.schema_fingerprint,
    source_hash: proof.multiset?.source_hash,
    sink_hash: proof.multiset?.sink_hash,
    manifest_digest: proof.sink_artifacts?.manifest_digest || null,
    file_digest_count: String(proof.sink_artifacts?.file_digests?.length || 0),
    gateway_enforced: Boolean(gatewayStamp?.input_enforced),
    gateway_served_at: gatewayStamp?.served_at || null,
    gateway_row_count: gatewayStamp?.row_count || null,
  };
}

/**
 * Decision attestation binds agent output to cryptographically verified VRP input proofs.
 * Input proofs must verify offline before attestation is minted (fail closed).
 */
async function buildDecisionAttestation(options = {}) {
  const {
    sessionId,
    decisionId,
    pipelineRunId,
    inputProofs = [],
    gatewayToken,
    gatewayTokens = [],
    outputPayload,
    toolCalls = [],
    icebergSnapshotId,
    sign = true,
    now,
  } = options;

  if (!sessionId) {
    return { verdict: "FAIL", error: "sessionId required", attestation: null };
  }

  const tokens = gatewayToken ? [gatewayToken] : gatewayTokens;
  const verifiedInputs = [];

  if (tokens.length) {
    for (const token of tokens) {
      try {
        const resolved = await resolveGatewayInputs(token, sessionId);
        verifiedInputs.push(normalizeInputBinding(resolved.proof, resolved.gatewayStamp));
      } catch (err) {
        const message = err instanceof ProofGatewayError ? err.message : err.message;
        return { verdict: "FAIL", error: `gateway input resolution failed: ${message}`, attestation: null };
      }
    }
  } else if (inputProofs.length) {
    if (process.env.VRP_ALLOW_DECLARED_INPUTS !== "true") {
      return {
        verdict: "UNVERIFIED",
        error: "declared inputProofs rejected — serve data via proof gateway (gatewayToken required)",
        attestation: null,
      };
    }
    for (const proof of inputProofs) {
      const verification = verifyVrpProof(proof, {
        now,
        requireSignature: options.requireSignedInputProofs ?? Boolean(proof.signing?.signature),
        requireSnapshotPin: false,
      });
      if (!verification.valid) {
        return {
          verdict: "FAIL",
          error: `input proof failed verification: ${verification.reason}`,
          attestation: null,
        };
      }
      verifiedInputs.push(normalizeInputBinding(proof));
    }
  } else {
    return { verdict: "UNVERIFIED", error: "no gateway tokens — attestation requires gateway-served inputs", attestation: null };
  }

  const signedAt = (now ? new Date(now) : new Date()).toISOString();
  const validity = proofValidityWindow(signedAt);
  const attestationBody = {
    attestation_version: "1",
    session_id: sessionId,
    decision_id: decisionId || crypto.randomUUID(),
    nonce: crypto.randomUUID(),
    pipeline_run_id: pipelineRunId || verifiedInputs[0]?.pipeline_run_id || `run-${crypto.randomUUID()}`,
    iceberg_snapshot_id: icebergSnapshotId || null,
    inputs: verifiedInputs,
    output_hash: sha256Canonical(outputPayload ?? {}),
    tool_calls_hash: sha256Canonical(toolCalls),
    ...validity,
    signed_at: signedAt,
  };

  let signing = null;
  if (sign) {
    const bytes = Buffer.from(canonicalJson(attestationBody), "utf8");
    signing = await signProofPayload(bytes);
  }

  return {
    verdict: "PASS",
    attestation: {
      ...attestationBody,
      signing,
    },
  };
}

function attestationBodyFromEnvelope(attestation) {
  if (!attestation || typeof attestation !== "object") {
    throw new Error("decision attestation must be an object");
  }
  const { signing: _signing, ...body } = attestation;
  return body;
}

function checkPass(check) {
  if (check.skipped) return true;
  return Boolean(check.valid);
}

function verifyDecisionAttestation(attestation, options = {}) {
  const requireSignature = options.requireSignature !== false;
  const checks = {
    version: attestation?.attestation_version === "1",
    validity: verifyProofValidity(attestation, options),
    signature: requireSignature
      ? verifyProofSignature(attestation, options)
      : { valid: true, skipped: true },
    inputs: { valid: Array.isArray(attestation?.inputs) && attestation.inputs.length > 0, reason: null },
  };

  if (!checks.inputs.valid) {
    checks.inputs.reason = "attestation has no input bindings";
  }

  if (options.outputPayload != null && attestation?.output_hash) {
    const expected = sha256Canonical(options.outputPayload);
    checks.output = {
      valid: expected === attestation.output_hash,
      reason: expected === attestation.output_hash ? null : "output_hash mismatch",
    };
  } else {
    checks.output = { valid: true, skipped: true };
  }

  if (options.toolCalls != null && attestation?.tool_calls_hash) {
    const expected = sha256Canonical(options.toolCalls);
    checks.toolCalls = {
      valid: expected === attestation.tool_calls_hash,
      reason: expected === attestation.tool_calls_hash ? null : "tool_calls_hash mismatch",
    };
  } else {
    checks.toolCalls = { valid: true, skipped: true };
  }

  const valid =
    checks.version &&
    checkPass(checks.validity) &&
    checkPass(checks.inputs) &&
    checkPass(checks.signature) &&
    checkPass(checks.output) &&
    checkPass(checks.toolCalls);

  const reasons = [];
  if (!checks.version) reasons.push("unsupported attestation_version");
  if (!checkPass(checks.validity)) reasons.push(checks.validity.reason);
  if (!checkPass(checks.inputs)) reasons.push(checks.inputs.reason);
  if (!checkPass(checks.signature)) reasons.push(checks.signature.reason);
  if (!checkPass(checks.output)) reasons.push(checks.output.reason);
  if (!checkPass(checks.toolCalls)) reasons.push(checks.toolCalls.reason);

  return {
    valid,
    verdict: valid ? "VERIFIED" : "UNVERIFIED",
    checks,
    reason: reasons.filter(Boolean).join("; ") || null,
  };
}

module.exports = {
  buildDecisionAttestation,
  verifyDecisionAttestation,
  attestationBodyFromEnvelope,
  normalizeInputBinding,
};
