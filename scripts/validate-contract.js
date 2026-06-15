#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const contractPath = process.argv[2];
if (!contractPath) {
  console.error("Usage: npm run validate:contract -- <path-to-contract.yaml>");
  process.exit(1);
}

const schemaPath = path.join(__dirname, "..", "schemas", "data-contract-v1.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const raw = fs.readFileSync(path.resolve(contractPath), "utf8");
const doc = yaml.load(raw);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

if (validate(doc)) {
  console.log(`✓ Valid CogniMesh DataContract: ${doc.metadata.name}@${doc.metadata.version}`);
  process.exit(0);
}

console.error(`✗ Invalid DataContract: ${contractPath}`);
for (const err of validate.errors) {
  console.error(`  ${err.instancePath || "/"}: ${err.message}`);
}
process.exit(1);
