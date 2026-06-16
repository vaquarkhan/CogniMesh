#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const zipArg = process.argv[2];
if (!zipArg) {
  console.error("Usage: node scripts/test-lambda-zip.js <path-to.zip>");
  process.exit(1);
}

const zipPath = path.resolve(zipArg);
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cognimesh-lambda-"));
execSync(`tar -xf ${JSON.stringify(zipPath)} -C ${JSON.stringify(workDir)}`, { stdio: "inherit" });

process.chdir(workDir);
const handler = require(path.join(workDir, "handler"));
const sample = {
  contract: {
    apiVersion: "cognimesh.io/v1",
    metadata: { name: "zip-smoke", domain: "test", version: "1.0.0" },
    spec: {
      source: { type: "inline", schema: [{ name: "id", type: "string" }] },
      transform: { type: "map" },
      target: { type: "s3", location: "s3://example/bronze", format: "parquet" },
    },
  },
};

(async () => {
  const result = await handler.handler(sample);
  if (result == null) throw new Error("handler returned null");
  console.log(`OK: handler loads and runs from ${zipPath}`);
})();
