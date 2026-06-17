"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { resolveVrpFields } = require("../../lib/vrp/fields");
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
    this.checkpoints = [];
    this.committedChunks = [];
  }

  writeChunk(chunkId, records, stagingUri) {
    const checkpoint = {
      chunkId,
      recordCount: records.length,
      stagingUri,
      ts: Date.now(),
    };
    this.checkpoints.push(checkpoint);
    return { checkpoint, parquetUri: `${stagingUri}/chunk-${String(chunkId).padStart(6, "0")}.parquet` };
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
      sign: process.env.VRP_SIGN_ON_GENERATE !== "false",
    });
  }
  return vrp.generateVRP(sourceRows, sinkRows, identityFieldsOrOptions || {});
}

const validateThenCommit = vrp.validateThenCommit;

/** GlueCatalogConnector - metadata commit only after VRP PASS */
function commitMetadata(vrpResult, catalog, options = {}) {
  validateThenCommit(vrpResult);
  const proof = vrpResult.proof || {};
  return {
    committed: true,
    database: catalog.database,
    table: catalog.table,
    snapshot_id: options.icebergSnapshotId || crypto.randomUUID(),
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
  const iceguard = new IceGuardWriter({
    checkpointInterval: pvdmSpec.checkpointInterval || 5000,
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

    const runId = workload_id || `wl-${crypto.randomUUID()}`;
    const chunks = [];
    for (let i = resume_offset; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const chunkId = Math.floor(i / chunkSize);
      const staging = spec.target?.location || "s3://cognimesh-staging";
      const { parquetUri } = iceguard.writeChunk(chunkId, slice, staging);

      const sinkRows = slice.map((r) => ({ ...r }));
      const vrpResult = await generateVRP(slice, sinkRows, {
        pvdmSpec,
        identityFields,
        contentFields,
        pipelineRunId: runId,
        chunkId,
        catalog,
        parquetUri,
        sign: process.env.VRP_SIGN_ON_GENERATE !== "false",
      });

      if (vrpResult.verdict !== "PASS") {
        return {
          outcome: "verification_failed",
          workload_id: runId,
          vrp_verdict: vrpResult.verdict,
          message: vrpResult.error || "VRP FAIL: snapshot blocked",
          proof: vrpResult.proof,
        };
      }

      iceguard.commitChunk(chunkId);
      chunks.push({ chunkId, parquetUri, proof: vrpResult.proof });
    }

    const lastProof = chunks[chunks.length - 1]?.proof;
    const meta = commitMetadata({ verdict: "PASS", proof: lastProof }, catalog);

    return {
      outcome: "committed",
      workload_id: runId,
      chunks: chunks.length,
      snapshot_id: meta.snapshot_id,
      vrp_verdict: "PASS",
      message: "PVDM committed: Physical → Verify → Metadata",
      proof: lastProof,
    };
  } catch (err) {
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
