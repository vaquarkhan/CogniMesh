"use strict";

const crypto = require("crypto");
const { canonicalJson, sha256Canonical } = require("./canonical");
const { resolveVrpFields, schemaFingerprint } = require("./fields");
const { signProofPayload, proofValidityWindow } = require("./sign");

function hashMultiset(rows, fields) {
  const counts = {};
  for (const row of rows) {
    const key = fields.map((f) => String(row[f] ?? "")).join("|");
    counts[key] = String((Number(counts[key] || 0) + 1));
  }
  const sorted = {};
  for (const k of Object.keys(counts).sort()) sorted[k] = counts[k];
  return sha256Canonical(sorted);
}

function digestChunkArtifact(parquetUri, rows) {
  return {
    uri: parquetUri,
    sha256: sha256Canonical(rows),
    row_count: String(rows.length),
  };
}

/**
 * Build VRP with content-bound sink artifacts and signed attestation envelope.
 */
async function generateVRP(sourceRows, sinkRows, options = {}) {
  const {
    identityFields: idOverride,
    contentFields: contentOverride,
    pvdmSpec = {},
    pipelineRunId,
    chunkId = 0,
    catalog = {},
    parquetUri,
    manifestDigest,
    sign = true,
  } = options;

  const spec = {
    ...pvdmSpec,
    ...(idOverride ? { identityFields: idOverride } : {}),
    ...(contentOverride ? { contentFields: contentOverride } : {}),
  };

  const resolved = resolveVrpFields(sourceRows, spec);
  if (resolved.error) {
    return {
      verdict: "FAIL",
      error: resolved.error,
      proof: null,
    };
  }

  const { identityFields, contentFields } = resolved;
  const hashFields = [...new Set(identityFields.concat(contentFields))].sort();
  const sourceHash = hashMultiset(sourceRows, hashFields);
  const sinkHash = hashMultiset(sinkRows, hashFields);
  const verdict = sourceHash === sinkHash ? "PASS" : "FAIL";
  const signedAt = new Date().toISOString();
  const validity = proofValidityWindow(signedAt);

  const proofBody = {
    proof_version: "2",
    pipeline_run_id: pipelineRunId || `run-${crypto.randomUUID()}`,
    chunk_sequence: String(chunkId),
    table: {
      catalog_database: catalog.database || "default",
      catalog_table: catalog.table || "output",
    },
    schema_fingerprint: schemaFingerprint(sourceRows, hashFields),
    multiset: {
      identity_fields: identityFields,
      content_fields: contentFields,
      source_hash: sourceHash,
      sink_hash: sinkHash,
    },
    sink_artifacts: {
      manifest_digest: manifestDigest || null,
      file_digests: parquetUri ? [digestChunkArtifact(parquetUri, sinkRows)] : [],
    },
    ...validity,
    signed_at: signedAt,
  };

  let signatureEnvelope = null;
  if (sign && verdict === "PASS") {
    const bytes = Buffer.from(canonicalJson(proofBody), "utf8");
    signatureEnvelope = await signProofPayload(bytes);
  }

  return {
    verdict,
    proof: {
      ...proofBody,
      signing: signatureEnvelope,
    },
  };
}

function validateThenCommit(vrp) {
  if (!vrp || vrp.verdict !== "PASS") {
    const err = new Error("VRP validation failed: metadata commit blocked");
    err.code = "VERIFICATION_FAILED";
    err.proof = vrp?.proof;
    throw err;
  }
  if (!vrp.proof?.multiset?.source_hash) {
    const err = new Error("VRP proof missing required fields");
    err.code = "VERIFICATION_FAILED";
    throw err;
  }
  return vrp;
}

module.exports = {
  generateVRP,
  validateThenCommit,
  hashMultiset,
  digestChunkArtifact,
};
