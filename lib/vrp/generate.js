"use strict";

const crypto = require("crypto");
const { canonicalJson, sha256Canonical } = require("./canonical");
const { resolveVrpFields, schemaFingerprint } = require("./fields");
const { signProofPayload, proofValidityWindow } = require("./sign");
const { buildSnapshotPinSql } = require("./snapshot-pin");
const { proofId } = require("./transparency-log");
const { hashMultiset, hashMultisetProjections } = require("./multiset");
const { runTransformVerification } = require("./transform-verify");
const { resolveConformanceProfile } = require("./transform-oracle");
const { contractBinding } = require("./contract-bind");
const { resolveEnvironmentBinding } = require("./environment-bind");
const { sinkLogicalArtifact } = require("./logical-digest");
const { transformContentHash, buildReproducibleClaim } = require("./reproducible");
const { stewardKeyEpoch } = require("./steward-key");

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
    nonce,
    target,
    partition = "",
    ttlSec,
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
  const fieldTypes = spec.fieldTypes || spec.vrp?.fieldTypes || options.fieldTypes || {};
  const hashOpts = { ...options, fieldTypes };
  const sourceProj = hashMultisetProjections(sourceRows, identityFields, contentFields, hashOpts);
  const sinkProj = hashMultisetProjections(sinkRows, identityFields, contentFields, hashOpts);
  const sourceHash = sourceProj.content;
  const sinkHash = sinkProj.content;

  const transformResult = runTransformVerification(sourceRows, sinkRows, spec, hashFields);
  const identityMatch = sourceProj.identity === sinkProj.identity;
  const contentMatch = sourceHash === sinkHash;
  let conformance;
  try {
    conformance = resolveConformanceProfile(spec, {
      sinkRows,
      independentRows: options.independentRows,
      producerImplId: options.producerImplId,
      independentImplId: options.independentImplId,
      producerAttestorId: options.producerAttestorId,
      independentAttestorId: options.independentAttestorId,
      producerArtifactDigest: options.producerArtifactDigest,
      independentArtifactDigest: options.independentArtifactDigest,
      conformanceProfile: options.conformanceProfile,
      fieldTypes,
    });
  } catch (err) {
    return { verdict: "FAIL", error: err.message, proof: null };
  }
  const mode = transformResult.transform_mode;
  const sourceFingerprint = schemaFingerprint(sourceRows, hashFields, fieldTypes);
  const sinkFingerprint = schemaFingerprint(sinkRows, hashFields, fieldTypes);
  const schemaAligned = sourceFingerprint === sinkFingerprint;
  const sourceSnapshotId =
    options.sourceSnapshotId ||
    spec.sourceSnapshotId ||
    spec.vrp?.sourceSnapshotId ||
    `inline:${sha256Canonical({
      fields: hashFields,
      projection: sourceRows.map((r) => {
        const projected = {};
        for (const f of hashFields) projected[f] = r?.[f] ?? null;
        return projected;
      }),
    })}`;
  const expectedSource = options.expectedSourceSnapshotId || spec.expectedSourceSnapshotId;
  const sourceSnapshotAligned = !expectedSource || String(expectedSource) === String(sourceSnapshotId);
  const schemaFail = schemaAligned
    ? null
    : { message: "schema fingerprint mismatch — comparisons across differing schema MUST NOT be certified (paper N15)" };
  const snapshotFail = sourceSnapshotAligned
    ? null
    : { message: "source snapshot mismatch — comparisons across differing source snapshots MUST NOT be certified (paper N15)" };
  const projectionsPass = mode === "identity" ? identityMatch && contentMatch : transformResult.pass;
  const verdict =
    transformResult.pass &&
    projectionsPass &&
    conformance.verdict !== "FAIL" &&
    schemaAligned &&
    sourceSnapshotAligned
      ? "PASS"
      : "FAIL";

  const signedAt = new Date().toISOString();
  const validity = proofValidityWindow(signedAt, ttlSec);
  const snapshotPin = icebergSnapshotId
    ? buildSnapshotPinSql(catalog, icebergSnapshotId)
    : { sql: null, reason: "snapshot assigned at metadata commit" };

  const tHash = transformContentHash(spec);
  const logical = sinkLogicalArtifact(sinkRows, hashFields);

  const catalogTarget =
    target || `${catalog.database || "default"}.${catalog.table || "output"}`;

  const proofBody = {
    proof_version: "3",
    pipeline_run_id: pipelineRunId || `run-${crypto.randomUUID()}`,
    chunk_sequence: String(chunkId),
    nonce: nonce || crypto.randomUUID(),
    target: catalogTarget,
    partition,
    key_epoch: sourceProj.key_epoch || stewardKeyEpoch(),
    conformance_profile: conformance.profile,
    profile_t_certified: Boolean(conformance.profile_t_certified),
    verdict,
    table: {
      catalog_database: catalog.database || "default",
      catalog_table: catalog.table || "output",
    },
    environment_binding: resolveEnvironmentBinding(catalog, options.environment || {}),
    contract_binding: contract ? contractBinding(contract) : options.contractBinding || null,
    iceberg_snapshot_id: icebergSnapshotId || null,
    snapshot_pin: snapshotPin,
    schema_fingerprint: sourceFingerprint,
    source_schema_fingerprint: sourceFingerprint,
    sink_schema_fingerprint: sinkFingerprint,
    source_snapshot_id: sourceSnapshotId,
    multiset: {
      identity_fields: identityFields,
      content_fields: contentFields,
      source_hash: sourceHash,
      sink_hash: sinkHash,
      identity_source_hash: sourceProj.identity,
      identity_sink_hash: sinkProj.identity,
      construction: "mset-add-hmac-sha256",
      key_epoch: sourceProj.key_epoch,
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
    failure_localization: verdict === "FAIL" ? transformResult.divergence || schemaFail || snapshotFail : null,
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
    error:
      verdict === "FAIL"
        ? transformResult.divergence?.message ||
          schemaFail?.message ||
          snapshotFail?.message ||
          "transform verification failed"
        : null,
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
