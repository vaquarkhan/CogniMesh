"use strict";

const crypto = require("crypto");
const { canonicalJson, sha256Canonical } = require("./canonical");
const { resolveVrpFields, schemaFingerprint } = require("./fields");
const { signProofPayload, proofValidityWindow } = require("./sign");
const { buildSnapshotPinSql } = require("./snapshot-pin");
const { proofId } = require("./transparency-log");

function hashMultiset(rows, fields) {
  const counts = {};
  for (const row of rows) {
    const key = fields.map((f) => String(row[f] ?? "")).join("|");
    counts[key] = String(Number(counts[key] || 0) + 1);
  }
  const sorted = {};
  for (const k of Object.keys(counts).sort()) sorted[k] = counts[k];
  return sha256Canonical(sorted);
}

function digestChunkArtifact(parquetUri, sinkFileDigest) {
  if (!sinkFileDigest?.sha256 && !sinkFileDigest?.footer_sha256) {
    throw new Error("sink file digest required — hash persisted Parquet bytes, not in-memory rows");
  }
  return {
    uri: parquetUri,
    sha256: sinkFileDigest.footer_sha256 || sinkFileDigest.sha256,
    full_sha256: sinkFileDigest.full_sha256 || sinkFileDigest.sha256,
    footer_sha256: sinkFileDigest.footer_sha256 || sinkFileDigest.sha256,
    digest_type: sinkFileDigest.digest_type || "parquet_footer",
    row_count: String(sinkFileDigest.row_count ?? "0"),
  };
}

/**
 * Build VRP with content-bound sink artifacts and signed attestation envelope.
 * sinkRows must come from read-back of persisted chunk bytes (not a shallow copy of source).
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
    sinkFileDigest,
    icebergSnapshotId,
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
  const snapshotPin = icebergSnapshotId
    ? buildSnapshotPinSql(catalog, icebergSnapshotId)
    : { sql: null, reason: "snapshot assigned at metadata commit" };

  const proofBody = {
    proof_version: "2",
    pipeline_run_id: pipelineRunId || `run-${crypto.randomUUID()}`,
    chunk_sequence: String(chunkId),
    table: {
      catalog_database: catalog.database || "default",
      catalog_table: catalog.table || "output",
    },
    iceberg_snapshot_id: icebergSnapshotId || null,
    snapshot_pin: snapshotPin,
    schema_fingerprint: schemaFingerprint(sourceRows, hashFields),
    multiset: {
      identity_fields: identityFields,
      content_fields: contentFields,
      source_hash: sourceHash,
      sink_hash: sinkHash,
      sink_materialization: "read_back",
    },
    sink_artifacts: {
      manifest_digest: manifestDigest || null,
      file_digests: parquetUri && sinkFileDigest ? [digestChunkArtifact(parquetUri, sinkFileDigest)] : [],
    },
    ...validity,
    signed_at: signedAt,
  };

  let signatureEnvelope = null;
  if (sign && verdict === "PASS") {
    try {
      const bytes = Buffer.from(canonicalJson(proofBody), "utf8");
      signatureEnvelope = await signProofPayload(bytes);
    } catch (err) {
      const signingErr = new Error(`VRP signing failed: ${err.message}`);
      signingErr.code = "SIGNING_FAILED";
      throw signingErr;
    }
  }

  const proof = {
    ...proofBody,
    proof_id: proofId(proofBody),
    signing: signatureEnvelope,
  };

  return {
    verdict,
    proof,
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
  if (vrp.proof.multiset.sink_materialization !== "read_back") {
    const err = new Error("VRP proof missing read-back sink materialization");
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
