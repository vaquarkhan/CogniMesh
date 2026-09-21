#!/usr/bin/env node
"use strict";

/**
 * Verify published VRP conformance fixtures.
 * Fixtures have fixed not_before/not_after windows — evaluate at mid-window
 * so the suite does not rot when wall-clock time passes (regression guard).
 */
const fs = require("fs");
const path = require("path");
const { verifyVrpProof } = require("../lib/vrp/verify");

const fixtureDir = path.join(__dirname, "..", "fixtures", "vrp-conformance");
const vectors = [
  { file: "identity-pass.json", expectValid: true },
  { file: "identity-tampered.json", expectValid: false },
  { file: "aggregate-pass.json", expectValid: true },
  { file: "aggregate-tampered.json", expectValid: false },
];

function evaluationNow(proof) {
  if (!proof?.not_before || !proof?.not_after) return undefined;
  const start = new Date(proof.not_before).getTime();
  const end = new Date(proof.not_after).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return proof.not_before;
  return new Date(start + Math.floor((end - start) / 2)).toISOString();
}

let failed = 0;
for (const vector of vectors) {
  const proof = JSON.parse(fs.readFileSync(path.join(fixtureDir, vector.file), "utf8"));
  const result = verifyVrpProof(proof, {
    requireSignature: false,
    now: evaluationNow(proof),
  });
  const ok = result.valid === vector.expectValid;
  if (!ok) {
    failed++;
    console.error(
      `FAIL ${vector.file}: expected valid=${vector.expectValid}, got valid=${result.valid} (${result.reason})`
    );
  } else {
    console.log(`OK ${vector.file}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`All ${vectors.length} conformance vectors passed.`);
