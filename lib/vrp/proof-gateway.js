"use strict";

const fs = require("fs");
const path = require("path");
const { verifyVrpProof } = require("./verify");
const { signGatewayStamp } = require("./gateway-token");
const { readChunkRecords } = require("./chunk-store");
const { resolveSnapshotForRead } = require("../aws/glue-iceberg");

function gatewayCacheDir() {
  return process.env.VRP_GATEWAY_CACHE || path.join(process.cwd(), ".gateway-proof-cache");
}

function cacheProofForGateway(proof) {
  const dir = gatewayCacheDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${proof.proof_id}.json`);
  fs.writeFileSync(file, JSON.stringify(proof), "utf8");
  return file;
}

class ProofGatewayError extends Error {
  constructor(message, code = "PROOF_GATEWAY_DENIED") {
    super(message);
    this.code = code;
  }
}

async function loadProofArtifact(proofOrRef) {
  if (proofOrRef?.proof_version) return proofOrRef;
  if (proofOrRef?.localPath && fs.existsSync(proofOrRef.localPath)) {
    return JSON.parse(fs.readFileSync(proofOrRef.localPath, "utf8"));
  }
  if (proofOrRef?.s3Uri?.startsWith("s3://")) {
    const { getObjectBytes } = require("../aws/s3-proof-io");
    const bytes = await getObjectBytes(proofOrRef.s3Uri);
    return JSON.parse(bytes.toString("utf8"));
  }
  throw new ProofGatewayError("proof artifact not found");
}

/**
 * Proof-aware data gateway: verify proof, read pinned snapshot materialization, stamp what was served.
 */
async function serveProofGatedDataset(options = {}) {
  const { proof: proofInput, sessionId, localPath, limit = 1000 } = options;
  if (!sessionId) throw new ProofGatewayError("sessionId required");

  const proof = await loadProofArtifact(proofInput);
  const verification = verifyVrpProof(proof, {
    checkTransparencyLog: false,
    requireSignature: Boolean(proof.signing?.signature),
    requireSnapshotPin: true,
    localPath,
  });
  if (!verification.valid) {
    throw new ProofGatewayError(verification.reason || "proof verification failed");
  }
  if (process.env.VRP_REQUIRE_TRANSPARENCY_LOG === "true") {
    const { verifyInTransparencyLogAsync } = require("./transparency-log");
    const logCheck = await verifyInTransparencyLogAsync(proof);
    if (!logCheck.valid) {
      throw new ProofGatewayError(logCheck.reason || "proof not in transparency log");
    }
  }

  const snapshotId = await resolveSnapshotForRead(proof.table, proof.iceberg_snapshot_id);
  if (snapshotId && String(snapshotId) !== String(proof.iceberg_snapshot_id)) {
    throw new ProofGatewayError("catalog snapshot does not match proof iceberg_snapshot_id");
  }

  let rows = [];
  if (localPath) {
    const read = await readChunkRecords(localPath);
    rows = read.rows.slice(0, limit);
  }

  const stamp = {
    gateway_version: "1",
    session_id: sessionId,
    proof_id: proof.proof_id,
    pipeline_run_id: proof.pipeline_run_id,
    iceberg_snapshot_id: proof.iceberg_snapshot_id,
    snapshot_pin_sql: proof.snapshot_pin?.sql || null,
    served_at: new Date().toISOString(),
    row_count: String(rows.length),
    input_enforced: true,
  };

  cacheProofForGateway(proof);

  return {
    rows,
    proof,
    gatewayStamp: stamp,
    gatewayToken: signGatewayStamp(stamp),
    verification,
  };
}

/**
 * Resolve gateway token to verified proof for agent attestation (inputs served, not declared).
 */
async function resolveGatewayInputs(gatewayToken, sessionId) {
  const { verifyGatewayToken } = require("./gateway-token");
  const tokenCheck = verifyGatewayToken(gatewayToken, { sessionId });
  if (!tokenCheck.valid) {
    throw new ProofGatewayError(tokenCheck.reason || "invalid gateway token");
  }
  const cacheFile = path.join(gatewayCacheDir(), `${tokenCheck.stamp.proof_id}.json`);
  const proofPath = process.env.VRP_PROOF_DIR || path.join(process.cwd(), ".pvdm-proofs");
  const rel = tokenCheck.stamp.pipeline_run_id;
  const candidates = [];
  if (fs.existsSync(cacheFile)) {
    candidates.push(cacheFile);
  }
  if (fs.existsSync(proofPath)) {
    for (const domain of fs.readdirSync(proofPath)) {
      const domainPath = path.join(proofPath, domain);
      if (!fs.statSync(domainPath).isDirectory()) continue;
      for (const name of fs.readdirSync(domainPath)) {
        const file = path.join(domainPath, name, `${rel}.json`);
        if (fs.existsSync(file)) candidates.push(file);
      }
    }
  }
  const localPath = candidates[0];
  const proof = localPath
    ? JSON.parse(fs.readFileSync(localPath, "utf8"))
    : await loadProofArtifact({ proof_id: tokenCheck.stamp.proof_id });

  const verification = verifyVrpProof(proof, {
    checkTransparencyLog: process.env.VRP_REQUIRE_TRANSPARENCY_LOG === "true",
    requireSignature: Boolean(proof.signing?.signature),
    requireSnapshotPin: true,
  });
  if (!verification.valid) {
    throw new ProofGatewayError(verification.reason || "stale proof on gateway token");
  }
  if (proof.proof_id !== tokenCheck.stamp.proof_id) {
    throw new ProofGatewayError("gateway token proof_id mismatch");
  }

  return { proof, gatewayStamp: tokenCheck.stamp, verification };
}

module.exports = {
  ProofGatewayError,
  serveProofGatedDataset,
  resolveGatewayInputs,
  loadProofArtifact,
};
