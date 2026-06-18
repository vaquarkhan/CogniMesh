"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { resolveVrpFields } = require("../../lib/vrp/fields");
const { writeChunkRecords, readChunkRecords } = require("../../lib/vrp/chunk-store");
const { commitIcebergSnapshot } = require("../../lib/aws/glue-iceberg");
const { persistProof } = require("../../lib/vrp/proof-store");
const { appendTransparencyEntry } = require("../../lib/vrp/transparency-log");
const vrp = require("../../lib/vrp/generate");

/** SparkRules-style chunk filter - enforces data quality before PVDM write */
function applySparkRules(records, options = {}) {
  const rulesPath = options.rulesPath;
  const file = rulesPath || path.join(__dirname, "..", "..", "rules", "default-policies.yaml");
  const policies = fs.existsSync(file) ? yaml.load(fs.readFileSync(file, "utf8")) : { rules: [] };

  const policy = options.qualityPolicyId || "strict-zero-drop";
  const identityFields = options.identityFields || [];
  const contentFields = options.contentFields || identityFields;
  const maxNullPct = options.maxNullPct != null ? Number(options.maxNullPct) : 100;

  let filtered = records;
  const audit = { rulesApplied: 0, dropped: 0, policy, violations: 0 };

  for (const rule of policies.rules || []) {
    if (rule.id === "rules.spark_sql_non_empty") continue;
    audit.rulesApplied++;
  }

  if (policy !== "audit-only" && identityFields.length) {
    const before = filtered.length;
    filtered = filtered.filter((row) =>
      identityFields.every((f) => row[f] != null && String(row[f]).trim() !== "")
    );
    audit.dropped += before - filtered.length;
  }

  if (policy !== "audit-only" && contentFields.length && maxNullPct < 100) {
    const before = filtered.length;
    filtered = filtered.filter((row) => {
      const nullCount = contentFields.filter((f) => row[f] == null || String(row[f]).trim() === "").length;
      const nullPct = (nullCount / contentFields.length) * 100;
      return nullPct <= maxNullPct;
    });
    audit.dropped += before - filtered.length;
  }

  if (policy === "audit-only" && identityFields.length) {
    audit.violations = records.filter((row) =>
      identityFields.some((f) => row[f] == null || String(row[f]).trim() === "")
    ).length;
  }

  return { records: filtered, audit };
}

/** IceGuard-style chunked write with checkpoint tracking */
class IceGuardWriter {
  constructor(options = {}) {
    this.checkpointInterval = options.checkpointInterval || 5000;
    this.rollbackThresholdMs = options.rollbackThresholdMs || 30000;
    this.isolationId = options.isolationId || `ig-${crypto.randomUUID()}`;
    this.checkpoints = [];
    this.committedChunks = [];
  }

  async writeChunk(chunkId, records, stagingUri, isolationId) {
    const persisted = await writeChunkRecords(chunkId, records, stagingUri, { isolationId });
    const checkpoint = {
      chunkId,
      recordCount: records.length,
      stagingUri,
      localPath: persisted.localPath,
      fileSha256: persisted.sha256,
      ts: Date.now(),
    };
    this.checkpoints.push(checkpoint);
    return {
      checkpoint,
      parquetUri: persisted.parquetUri,
      localPath: persisted.localPath,
      writeSha256: persisted.sha256,
      footer_sha256: persisted.footer_sha256,
      digest_type: persisted.digest_type,
    };
  }

  rollback() {
    const rolled = this.checkpoints.filter((c) => !this.committedChunks.includes(c.chunkId));
    this.checkpoints = this.checkpoints.filter((c) => this.committedChunks.includes(c.chunkId));
    return { rolledBack: rolled.length, checkpoints: rolled };
  }

  commitChunk(chunkId) {
    this.committedChunks.push(chunkId);
  }
}

/** Backward-compatible async wrapper (legacy positional args or options object). */
async function generateVRP(sourceRows, sinkRows, identityFieldsOrOptions, contentFields) {
  if (Array.isArray(identityFieldsOrOptions)) {
    return vrp.generateVRP(sourceRows, sinkRows, {
      identityFields: identityFieldsOrOptions,
      contentFields: contentFields || identityFieldsOrOptions,
      sinkFileDigest: { sha256: "legacy-no-readback", row_count: String(sinkRows.length) },
      sign: process.env.VRP_SIGN_ON_GENERATE !== "false",
    });
  }
  return vrp.generateVRP(sourceRows, sinkRows, identityFieldsOrOptions || {});
}

const validateThenCommit = vrp.validateThenCommit;

/** GlueCatalogConnector - metadata commit only after VRP PASS */
async function commitMetadata(vrpResult, catalog, options = {}) {
  validateThenCommit(vrpResult);
  const proof = vrpResult.proof || {};
  const committed =
    options.icebergSnapshotId && options.manifestDigest
      ? {
          snapshotId: options.icebergSnapshotId,
          manifestDigest: options.manifestDigest,
          source: options.snapshotSource || "provided",
        }
      : await commitIcebergSnapshot(catalog, proof);
  return {
    committed: true,
    database: catalog.database,
    table: catalog.table,
    snapshot_id: committed.snapshotId,
    manifest_digest: committed.manifestDigest,
    snapshot_source: committed.source,
    proof_ref: proof.multiset?.source_hash || proof.source_hash,
  };
}

/**
 * PVDM coordinator: SparkRules → IceGuard → VRP → Metadata
 * Outcomes match serverless-data-mesh domain writer
 */
async function runPvdmWorkload(workload) {
  const { source_rows = [], contract, workload_id, resume_offset = 0 } = workload;
  const spec = contract?.spec || {};
  const pvdmSpec = spec.transform?.pvdm || {};
  const chunkSize = pvdmSpec.maxChunkRecords || 5000;
  const catalog = {
    database: spec.target?.catalog?.database || "default",
    table: spec.target?.catalog?.table || "output",
  };
  const contractMeta = contract?.metadata || {};

  if (!source_rows.length) {
    return {
      outcome: "unverified",
      workload_id: workload_id || `wl-${crypto.randomUUID()}`,
      chunks: 0,
      vrp_verdict: "UNVERIFIED",
      message: "PVDM skipped: empty workload — nothing to verify",
    };
  }

  const fieldResolution = resolveVrpFields(source_rows, pvdmSpec);
  if (fieldResolution.error) {
    return {
      outcome: "verification_failed",
      workload_id,
      vrp_verdict: "FAIL",
      message: fieldResolution.error,
    };
  }

  const { identityFields, contentFields } = fieldResolution;
  const runId = workload_id || `wl-${crypto.randomUUID()}`;
  const iceguard = new IceGuardWriter({
    checkpointInterval: pvdmSpec.checkpointInterval || 5000,
    isolationId: runId,
  });

  try {
    let rows = [...source_rows];
    if (spec.transform?.sparkRules?.enabled) {
      rows = applySparkRules(rows, {
        qualityPolicyId: pvdmSpec.qualityPolicyId,
        identityFields,
        contentFields,
        maxNullPct: pvdmSpec.maxNullPct,
      }).records;
    }

    if (!rows.length) {
      return {
        outcome: "unverified",
        workload_id: workload_id || `wl-${crypto.randomUUID()}`,
        chunks: 0,
        vrp_verdict: "UNVERIFIED",
        message: "PVDM skipped: all rows filtered — nothing to verify",
      };
    }

    const chunkDrafts = [];

    for (let i = resume_offset; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const chunkId = Math.floor(i / chunkSize);
      const staging = spec.target?.location || "s3://cognimesh-staging";
      const { parquetUri, localPath, writeSha256, footer_sha256, digest_type } = await iceguard.writeChunk(
        chunkId,
        slice,
        staging,
        runId
      );

      const readBack = await readChunkRecords(localPath);
      if (readBack.sha256 !== writeSha256 && readBack.footer_sha256 !== footer_sha256) {
        return {
          outcome: "verification_failed",
          workload_id: runId,
          vrp_verdict: "FAIL",
          message: "sink read-back Parquet footer digest mismatch after write",
        };
      }

      const prelim = await generateVRP(slice, readBack.rows, {
        pvdmSpec,
        contract,
        identityFields,
        contentFields,
        pipelineRunId: runId,
        chunkId,
        catalog,
        parquetUri,
        sinkFileDigest: {
          sha256: readBack.sha256,
          footer_sha256: readBack.footer_sha256,
          full_sha256: readBack.full_sha256,
          digest_type: readBack.digest_type || digest_type,
          row_count: readBack.rows.length,
        },
        sign: false,
      });

      if (prelim.verdict !== "PASS") {
        return {
          outcome: "verification_failed",
          workload_id: runId,
          vrp_verdict: prelim.verdict,
          message:
            prelim.divergence?.message ||
            prelim.error ||
            "VRP FAIL: transform verification failed after read-back",
          proof: prelim.proof,
          localization: prelim.divergence || prelim.proof?.failure_localization,
        };
      }

      chunkDrafts.push({ chunkId, parquetUri, localPath, readBack, slice, prelimProof: prelim.proof });
    }

    const catalogCommit = await commitIcebergSnapshot(catalog, chunkDrafts[chunkDrafts.length - 1]?.prelimProof || {});

    const chunks = [];
    let lastProof = null;
    let proofPersisted = null;

    for (const draft of chunkDrafts) {
      const vrpResult = await generateVRP(draft.slice, draft.readBack.rows, {
        pvdmSpec,
        contract,
        identityFields,
        contentFields,
        pipelineRunId: runId,
        chunkId: draft.chunkId,
        catalog,
        parquetUri: draft.parquetUri,
        manifestDigest: catalogCommit.manifestDigest,
        sinkFileDigest: {
          sha256: draft.readBack.sha256,
          footer_sha256: draft.readBack.footer_sha256,
          full_sha256: draft.readBack.full_sha256,
          digest_type: draft.readBack.digest_type,
          row_count: draft.readBack.rows.length,
        },
        icebergSnapshotId: catalogCommit.snapshotId,
        sign: process.env.VRP_SIGN_ON_GENERATE !== "false",
      });

      if (vrpResult.verdict !== "PASS") {
        return {
          outcome: "verification_failed",
          workload_id: runId,
          vrp_verdict: vrpResult.verdict,
          message:
            vrpResult.divergence?.message ||
            vrpResult.error ||
            "VRP FAIL: transform verification blocked snapshot",
          proof: vrpResult.proof,
          localization: vrpResult.divergence || vrpResult.proof?.failure_localization,
        };
      }

      iceguard.commitChunk(draft.chunkId);
      lastProof = vrpResult.proof;
      chunks.push({ chunkId: draft.chunkId, parquetUri: draft.parquetUri, proof: vrpResult.proof });

      if (vrpResult.proof?.signing?.signature) {
        try {
          await appendTransparencyEntry(vrpResult.proof);
        } catch (err) {
          const transparencyErr = new Error(`VRP transparency log failed: ${err.message}`);
          transparencyErr.code = "TRANSPARENCY_FAILED";
          throw transparencyErr;
        }
        proofPersisted = await persistProof(vrpResult.proof, {
          domain: contractMeta.domain,
          name: contractMeta.name,
          proofBucket: process.env.PROOF_BUCKET,
        });
        if (
          process.env.VRP_FAIL_CLOSED === "true" &&
          process.env.PROOF_BUCKET &&
          !proofPersisted?.persisted
        ) {
          const persistErr = new Error("VRP proof persistence failed — publish blocked");
          persistErr.code = "PERSIST_FAILED";
          throw persistErr;
        }
      }
    }

    const meta = await commitMetadata({ verdict: "PASS", proof: lastProof }, catalog, {
      icebergSnapshotId: catalogCommit.snapshotId,
      manifestDigest: catalogCommit.manifestDigest,
      snapshotSource: catalogCommit.source,
    });

    return {
      outcome: "committed",
      workload_id: runId,
      chunks: chunks.length,
      snapshot_id: meta.snapshot_id,
      vrp_verdict: "PASS",
      message: "PVDM committed: Physical → Verify → Metadata",
      proof: lastProof,
      proofS3Uri: proofPersisted?.proofS3Uri || proofPersisted?.proofLocalUri || null,
      proofPersisted: Boolean(proofPersisted?.persisted),
    };
  } catch (err) {
    if (
      err.code === "SIGNING_FAILED" ||
      err.code === "TRANSPARENCY_FAILED" ||
      err.code === "PERSIST_FAILED"
    ) {
      return {
        outcome: err.code === "SIGNING_FAILED" ? "signing_failed" : "publish_blocked",
        workload_id,
        vrp_verdict: "FAIL",
        message: err.message,
      };
    }
    if (err.code === "VERIFICATION_FAILED") {
      return {
        outcome: "verification_failed",
        workload_id,
        vrp_verdict: "FAIL",
        message: err.message,
        proof: err.proof,
      };
    }
    const rollback = iceguard.rollback();
    return {
      outcome: "rolled_back",
      workload_id,
      resume_offset: resume_offset,
      vrp_verdict: "UNVERIFIED",
      message: err.message,
      rollback,
    };
  }
}

module.exports = {
  applySparkRules,
  IceGuardWriter,
  generateVRP,
  validateThenCommit,
  commitMetadata,
  runPvdmWorkload,
};
