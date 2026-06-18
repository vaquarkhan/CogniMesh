"use strict";

const crypto = require("crypto");
const { canonicalJson } = require("./canonical");
const { resolveVrpFields, schemaFingerprint } = require("./fields");
const { signProofPayload, proofValidityWindow } = require("./sign");
const { buildSnapshotPinSql } = require("./snapshot-pin");
const { proofId } = require("./transparency-log");
const { hashMultiset } = require("./multiset");
const { runTransformVerification } = require("./transform-verify");
const { contractBinding } = require("./contract-bind");
const { resolveEnvironmentBinding } = require("./environment-bind");
const { sinkLogicalArtifact } = require("./logical-digest");
const { transformContentHash, buildReproducibleClaim } = require("./reproducible");

function digestChunkArtifact(parquetUri, sinkFileDigest) {
  if (!sinkFileDigest?.sha256 && !sinkFileDigest?.footer_sha256) {
    throw new Error("sink file digest required — hash persisted bytes, not in-memory rows");
  }
  return {
    uri: parquetUri,
    sha256: sinkFileDigest.footer_sha256 || sinkFileDigest.sha256,
    full_sha256: sinkFileDigest.full_sha256 || sinkFileDigest.sha256,
    footer_sha256: sinkFileDigest.footer_sha256 || sinkFileDigest.sha256,
    digest_type: sinkFileDigest.digest_type || "parquet_footer",
    row_count: String(sinkFileDigest.row_count ?? "0"),
    physical_binding: "secondary",
  };
}

/**
 * Build VRP v3 with transform verification, contract/env binding, logical digest, divergence on FAIL.
 */
async function generateVRP(sourceRows, sinkRows, options = {}) {
  const {
    identityFields: idOverride,
    contentFields: contentOverride,
    pvdmSpec = {},
    pipelineRunId,
    chunkId = 0,
    catalog = {},
    contract = null,
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
    return { verdict: "FAIL", error: resolved.error, proof: null };
  }

  const { identityFields, contentFields } = resolved;
  const hashFields = [...new Set(identityFields.concat(contentFields))].sort();
  const sourceHash = hashMultiset(sourceRows, hashFields);
  const sinkHash = hashMultiset(sinkRows, hashFields);

  const transformResult = runTransformVerification(sourceRows, sinkRows, spec, hashFields);
  const verdict = transformResult.pass ? "PASS" : "FAIL";

  const signedAt = new Date().toISOString();
  const validity = proofValidityWindow(signedAt);
  const snapshotPin = icebergSnapshotId
    ? buildSnapshotPinSql(catalog, icebergSnapshotId)
    : { sql: null, reason: "snapshot assigned at metadata commit" };

  const tHash = transformContentHash(spec);
  const logical = sinkLogicalArtifact(sinkRows, hashFields);

  const proofBody = {
    proof_version: "3",
    pipeline_run_id: pipelineRunId || `run-${crypto.randomUUID()}`,
    chunk_sequence: String(chunkId),
    table: {
      catalog_database: catalog.database || "default",
      catalog_table: catalog.table || "output",
    },
    environment_binding: resolveEnvironmentBinding(catalog, options.environment || {}),
    contract_binding: contract ? contractBinding(contract) : options.contractBinding || null,
    iceberg_snapshot_id: icebergSnapshotId || null,
    snapshot_pin: snapshotPin,
    schema_fingerprint: schemaFingerprint(sourceRows, hashFields),
    multiset: {
      identity_fields: identityFields,
      content_fields: contentFields,
      source_hash: sourceHash,
      sink_hash: sinkHash,
      sink_materialization: "read_back",
      mode: transformResult.transform_mode,
    },
    transform_verification: {
      mode: transformResult.transform_mode,
      invariants: transformResult.invariants,
      group_lineage_hash: transformResult.group_lineage_hash,
      transform_content_hash: tHash,
      numeric_model: "minor_units_for_money",
    },
    reproducible_computation: buildReproducibleClaim({
      transformHash: tHash,
      outputLogicalHash: logical.logical_content_hash,
      pipelineRunId: pipelineRunId || null,
      inputProofIds: options.inputProofIds || [],
    }),
    sink_artifacts: {
      manifest_digest: manifestDigest || null,
      logical_content: logical,
      file_digests: parquetUri && sinkFileDigest ? [digestChunkArtifact(parquetUri, sinkFileDigest)] : [],
    },
    failure_localization: verdict === "FAIL" ? transformResult.divergence : null,
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
    error: verdict === "FAIL" ? transformResult.divergence?.message || "transform verification failed" : null,
    divergence: transformResult.divergence,
  };
}

function validateThenCommit(vrp) {
  if (!vrp || vrp.verdict !== "PASS") {
    const err = new Error(
      vrp?.divergence?.message
        ? `VRP validation failed: ${vrp.divergence.message}`
        : "VRP validation failed: metadata commit blocked"
    );
    err.code = "VERIFICATION_FAILED";
    err.proof = vrp?.proof;
    err.divergence = vrp?.divergence || vrp?.proof?.failure_localization;
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
  if (vrp.proof.proof_version === "3" && vrp.proof.transform_verification) {
    const failed = (vrp.proof.transform_verification.invariants || []).find((c) => c.pass === false);
    if (failed) {
      const err = new Error(`VRP transform invariant failed: ${failed.id}`);
      err.code = "VERIFICATION_FAILED";
      err.proof = vrp.proof;
      throw err;
    }
  }
  return vrp;
}

module.exports = {
  generateVRP,
  validateThenCommit,
  hashMultiset,
  digestChunkArtifact,
};
