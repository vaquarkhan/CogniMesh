#!/usr/bin/env node
"use strict";

/**
 * Offline VRP proof verifier CLI.
 * Usage: node scripts/verify-vrp-proof.js path/to/proof.json [--public-key path.pem]
 */
const fs = require("fs");
const path = require("path");
const { verifyVrpProof } = require("../lib/vrp/verify");

function main() {
  const args = process.argv.slice(2);
  const proofPath = args.find((a) => !a.startsWith("--"));
  const pkFlag = args.indexOf("--public-key");
  const publicKeyPath = pkFlag >= 0 ? args[pkFlag + 1] : null;

  if (!proofPath) {
    console.error("Usage: node scripts/verify-vrp-proof.js <proof.json> [--public-key key.pem]");
    process.exit(2);
  }

  const proof = JSON.parse(fs.readFileSync(path.resolve(proofPath), "utf8"));
  const options = {};
  if (publicKeyPath) {
    options.publicKeyPem = fs.readFileSync(path.resolve(publicKeyPath), "utf8");
  }

  const result = verifyVrpProof(proof, options);
  console.log(JSON.stringify({ verdict: result.verdict, valid: result.valid, reason: result.reason }, null, 2));
  process.exit(result.valid ? 0 : 1);
}

main();
