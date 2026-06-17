"use strict";

const fs = require("fs");
const path = require("path");

function proofRoot() {
  return process.env.VRP_PROOF_DIR || path.join(process.cwd(), ".pvdm-proofs");
}

/**
 * Persist a signed proof artifact. Returns URI only when bytes were written.
 */
function persistProof(proof, meta = {}) {
  if (!proof?.signing?.signature && process.env.VRP_REQUIRE_SIGNED_PROOF !== "false") {
    return { persisted: false, proofS3Uri: null, proofLocalUri: null };
  }

  const domain = meta.domain || proof.table?.catalog_database || "default";
  const name = meta.name || proof.table?.catalog_table || "pipeline";
  const runId = proof.pipeline_run_id || `run-${Date.now()}`;
  const rel = `${domain}/${name}/${runId}.json`;
  const root = proofRoot();
  const localPath = path.join(root, rel);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(proof, null, 2), "utf8");

  const proofBucket = process.env.PROOF_BUCKET || meta.proofBucket;
  const proofS3Uri = proofBucket ? `s3://${proofBucket}/${rel}` : null;

  return {
    persisted: true,
    proofLocalUri: `file://${localPath.replace(/\\/g, "/")}`,
    proofS3Uri,
    localPath,
  };
}

module.exports = { persistProof, proofRoot };
