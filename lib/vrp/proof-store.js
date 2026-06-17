"use strict";

const fs = require("fs");
const path = require("path");
const { s3Enabled, putJsonObject } = require("../aws/s3-proof-io");

function proofRoot() {
  return process.env.VRP_PROOF_DIR || path.join(process.cwd(), ".pvdm-proofs");
}

function proofKey(proof, meta = {}) {
  const domain = meta.domain || proof.table?.catalog_database || "default";
  const name = meta.name || proof.table?.catalog_table || "pipeline";
  const runId = proof.pipeline_run_id || `run-${Date.now()}`;
  return { rel: `${domain}/${name}/${runId}.json`, runId };
}

async function persistProof(proof, meta = {}) {
  if (!proof?.signing?.signature && process.env.VRP_REQUIRE_SIGNED_PROOF !== "false") {
    return { persisted: false, proofS3Uri: null, proofLocalUri: null };
  }

  const { rel } = proofKey(proof, meta);
  const root = proofRoot();
  const localPath = path.join(root, rel);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(proof, null, 2), "utf8");

  let proofS3Uri = null;
  if (s3Enabled()) {
    const uploaded = await putJsonObject(`proofs/${rel}`, proof);
    if (uploaded.persisted) proofS3Uri = uploaded.s3Uri;
  } else {
    const proofBucket = process.env.PROOF_BUCKET || meta.proofBucket;
    if (proofBucket) proofS3Uri = `s3://${proofBucket}/proofs/${rel}`;
  }

  return {
    persisted: true,
    proofLocalUri: `file://${localPath.replace(/\\/g, "/")}`,
    proofS3Uri,
    localPath,
    s3Uri: proofS3Uri,
  };
}

module.exports = { persistProof, proofRoot, proofKey };
