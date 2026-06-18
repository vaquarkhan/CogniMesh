#!/usr/bin/env node
"use strict";

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

let failed = 0;
for (const vector of vectors) {
  const proof = JSON.parse(fs.readFileSync(path.join(fixtureDir, vector.file), "utf8"));
  const result = verifyVrpProof(proof, { requireSignature: false });
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
