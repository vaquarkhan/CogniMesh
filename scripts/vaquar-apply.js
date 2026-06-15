#!/usr/bin/env node
"use strict";

const { contractToMesh } = require("../lib/vaquar/contract-to-mesh");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

const contractPath = process.argv[2];
if (!contractPath) {
  console.error("Usage: node scripts/vaquar-apply.js <contract.yaml>");
  process.exit(1);
}

const contract = yaml.load(fs.readFileSync(path.resolve(contractPath), "utf8"));
const mesh = contractToMesh(contract);
const outDir = path.join(process.cwd(), "generated", contract.metadata.domain, contract.metadata.name);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "mesh.pipeline.yaml"), yaml.dump(mesh, { lineWidth: 120 }));
console.log(`Generated ${outDir}/mesh.pipeline.yaml`);
