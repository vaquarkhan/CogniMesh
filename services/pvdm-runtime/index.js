"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { resolveVrpFields } = require("../../lib/vrp/fields");
const { writeChunkRecords, readChunkRecords, deleteChunkArtifact } = require("../../lib/vrp/chunk-store");
const { commitIcebergSnapshot } = require("../../lib/aws/glue-iceberg");
const { persistProof } = require("../../lib/vrp/proof-store");
const { appendTransparencyEntry } = require("../../lib/vrp/transparency-log");
const { proofGatedCommit, commitNonces } = require("../../lib/vrp/steward-gate");
const {
  loadWorkload,
  recordChunkVerified,
  recordWorkloadCommitted,
  recordWorkloadFailed,
  verifiedDrafts,
} = require("../../lib/vrp/durable-log");
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

/** IceGuard-style chunked write with checkpoint tracking + timeout-aware abort */
class IceGuardWriter {
  constructor(options = {}) {
    this.checkpointInterval = options.checkpointInterval || 5000;
    this.rollbackThresholdMs = options.rollbackThresholdMs || 30000;
    this.getRemainingMs =
      typeof options.getRemainingMs === "function"
        ? options.getRemainingMs
        : () => Number.POSITIVE_INFINITY;
    this.isolationId = options.isolationId || `ig-${crypto.randomUUID()}`;
    this.checkpoints = [];
    this.committedChunks = [];
  }

  assertTimeBudget() {
    const remaining = this.getRemainingMs();
    if (remaining < this.rollbackThresholdMs) {
      const err = new Error(
        `IceGuardRollback: remaining time ${remaining}ms below threshold ${this.rollbackThresholdMs}ms`
      );
      err.code = "ICEGUARD_TIMEOUT";
      throw err;
    }
  }

  async writeChunk(chunkId, records, stagingUri, isolationId) {
    this.assertTimeBudget();
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
    const deletedPaths = [];
    for (const c of rolled) {
      if (deleteChunkArtifact(c.localPath)) deletedPaths.push(c.localPath);
    }
    this.checkpoints = this.checkpoints.filter((c) => this.committedChunks.includes(c.chunkId));
    return { rolledBack: rolled.length, checkpoints: rolled, deletedPaths };
  }

  /** Record offset for SFN resume: first uncommitted chunk start index. */
  nextResumeOffset(chunkSize, fallbackOffset = 0) {
    if (!this.committedChunks.length) return fallbackOffset;
    const nextChunkId = Math.max(...this.committedChunks) + 1;
    return nextChunkId * chunkSize;
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
 * PVDM coordinator (paper §4): Physical → Verify → Durable → Metadata last.
 * Invariant: commit_metadata ⟹ VRP = PASS. A failing proof yields no consumer-visible snapshot.
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
  const expectedTarget = `${catalog.database}.${catalog.table}`;

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

  const prior = loadWorkload(runId);
  if (prior?.outcome === "committed") {
    return {
      outcome: "committed",
      workload_id: runId,
      chunks: Object.keys(prior.chunks || {}).length,
      snapshot_id: prior.snapshot_id,
      vrp_verdict: "PASS",
      message: "PVDM Durable replay: workload already COMMITTED — chunks not rewritten",
      proof: prior.proof,
    };
  }

  const iceguard = new IceGuardWriter({
    checkpointInterval: pvdmSpec.checkpointInterval || 5000,
    rollbackThresholdMs: pvdmSpec.rollbackThresholdMs || 30000,
    isolationId: runId,
    getRemainingMs: workload.getRemainingMs,
  });

  const failClosed = (payload) => {
    const rollback = iceguard.rollback();
    recordWorkloadFailed(runId, payload.outcome);
    return { ...payload, workload_id: runId, rollback };
  };

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
        workload_id: runId,
        chunks: 0,
        vrp_verdict: "UNVERIFIED",
        message: "PVDM skipped: all rows filtered — nothing to verify",
      };
    }

    const chunkDrafts = [];
    const seen = new Set();
    for (const stored of verifiedDrafts(runId)) {
      chunkDrafts.push(stored);
      iceguard.commitChunk(stored.chunkId);
      seen.add(stored.chunkId);
    }

    for (let i = resume_offset; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const chunkId = Math.floor(i / chunkSize);
      if (seen.has(chunkId)) continue;

      const staging = spec.target?.location || "s3://cognimesh-staging";
      const { parquetUri, localPath, writeSha256, footer_sha256, digest_type } = await iceguard.writeChunk(
        chunkId,
        slice,
        staging,
        runId
      );

      const readBack = await readChunkRecords(localPath);
      if (readBack.sha256 !== writeSha256 && readBack.footer_sha256 !== footer_sha256) {
        return failClosed({
          outcome: "verification_failed",
          vrp_verdict: "FAIL",
          message: "sink read-back Parquet footer digest mismatch after write",
        });
      }

      const vrpResult = await generateVRP(slice, readBack.rows, {
        pvdmSpec,
        contract,
        identityFields,
        contentFields,
        pipelineRunId: runId,
        chunkId,
        catalog,
        target: expectedTarget,
        nonce: crypto.randomUUID(),
        parquetUri,
        sinkFileDigest: {
          sha256: readBack.sha256,
          footer_sha256: readBack.footer_sha256,
          full_sha256: readBack.full_sha256,
          digest_type: readBack.digest_type || digest_type,
          row_count: readBack.rows.length,
        },
        icebergSnapshotId: null,
        sign: process.env.VRP_SIGN_ON_GENERATE !== "false",
      });

      if (vrpResult.verdict !== "PASS") {
        return failClosed({
          outcome: "verification_failed",
          vrp_verdict: vrpResult.verdict,
          message:
            vrpResult.divergence?.message ||
            vrpResult.error ||
            "VRP FAIL: transform verification failed after read-back",
          proof: vrpResult.proof,
          localization: vrpResult.divergence || vrpResult.proof?.failure_localization,
        });
      }

      const draft = {
        chunkId,
        parquetUri,
        localPath,
        readBack,
        proof: vrpResult.proof,
      };
      iceguard.commitChunk(chunkId);
      recordChunkVerified(runId, chunkId, draft);
      chunkDrafts.push(draft);
    }

    if (!chunkDrafts.length) {
      return {
        outcome: "unverified",
        workload_id: runId,
        chunks: 0,
        vrp_verdict: "UNVERIFIED",
        message: "PVDM skipped: no chunks to commit",
      };
    }

    let lastProof = null;
    let proofPersisted = null;
    const chunks = [];

    for (const draft of chunkDrafts) {
      proofGatedCommit({
        proof: draft.proof,
        localPath: draft.localPath,
        expectedTarget,
        requireSignature: process.env.VRP_SIGN_ON_GENERATE !== "false" && !process.env.VRP_SIGNING_MODE,
      });

      lastProof = draft.proof;
      chunks.push({ chunkId: draft.chunkId, parquetUri: draft.parquetUri, proof: draft.proof });

      if (draft.proof?.signing?.signature) {
        try {
          await appendTransparencyEntry(draft.proof);
        } catch (err) {
          const transparencyErr = new Error(`VRP transparency log failed: ${err.message}`);
          transparencyErr.code = "TRANSPARENCY_FAILED";
          throw transparencyErr;
        }
        proofPersisted = await persistProof(draft.proof, {
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

    const catalogCommit = await commitIcebergSnapshot(catalog, lastProof);
    const meta = await commitMetadata({ verdict: "PASS", proof: lastProof }, catalog, {
      icebergSnapshotId: catalogCommit.snapshotId,
      manifestDigest: catalogCommit.manifestDigest,
      snapshotSource: catalogCommit.source,
    });
    commitNonces(chunkDrafts.map((d) => d.proof?.nonce));

    lastProof.commit_receipt = {
      iceberg_snapshot_id: meta.snapshot_id,
      manifest_digest: catalogCommit.manifestDigest,
      snapshot_source: catalogCommit.source,
      committed_at: new Date().toISOString(),
    };

    const result = {
      outcome: "committed",
      workload_id: runId,
      chunks: chunks.length,
      snapshot_id: meta.snapshot_id,
      vrp_verdict: "PASS",
      message: "PVDM committed: Physical → Verify → Durable → Metadata",
      proof: lastProof,
      proofS3Uri: proofPersisted?.proofS3Uri || proofPersisted?.proofLocalUri || null,
      proofPersisted: Boolean(proofPersisted?.persisted),
    };
    recordWorkloadCommitted(runId, result);
    return result;
  } catch (err) {
    if (
      err.code === "SIGNING_FAILED" ||
      err.code === "TRANSPARENCY_FAILED" ||
      err.code === "PERSIST_FAILED" ||
      err.code === "TOCTOU_FAILED" ||
      err.code === "STEWARD_KEY_MISSING"
    ) {
      iceguard.rollback();
      recordWorkloadFailed(runId, err.code === "SIGNING_FAILED" ? "signing_failed" : "publish_blocked");
      return {
        outcome: err.code === "SIGNING_FAILED" ? "signing_failed" : "publish_blocked",
        workload_id: runId,
        vrp_verdict: "FAIL",
        message: err.message,
      };
    }
    if (err.code === "VERIFICATION_FAILED" || err.code === "PROFILE_T_REFUSED") {
      iceguard.rollback();
      recordWorkloadFailed(runId, "verification_failed");
      return {
        outcome: "verification_failed",
        workload_id: runId,
        vrp_verdict: "FAIL",
        message: err.message,
        proof: err.proof,
      };
    }
    const rollback = iceguard.rollback();
    const nextOffset = iceguard.nextResumeOffset(chunkSize, resume_offset);
    return {
      outcome: "rolled_back",
      workload_id: runId,
      resume_offset: nextOffset,
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
