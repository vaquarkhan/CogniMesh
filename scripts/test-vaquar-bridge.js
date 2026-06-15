#!/usr/bin/env node
"use strict";

const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const { contractToMesh } = require("../lib/vaquar/contract-to-mesh");
const { compileVaquarStateMachine } = require("../lib/vaquar/pvdm-sfn");

const contract = yaml.load(
  fs.readFileSync(path.resolve("contracts/examples/structured-cdc-pipeline.yaml"), "utf8")
);
contract.spec.execution = { ...contract.spec.execution, pattern: "vaquar" };
contract.spec.transform.pvdm = {
  identityFields: ["order_id"],
  contentFields: ["order_id", "customer_id", "total_amount"],
};

const mesh = contractToMesh(contract);
if (mesh.apiVersion !== "sdm/v1") throw new Error("mesh apiVersion");
if (mesh.spec.runtime.pattern !== "vaquar") throw new Error("mesh pattern must be vaquar");

const sfn = compileVaquarStateMachine(contract);
if (sfn.StartAt !== "IntegrityGate") throw new Error("SFN must start at IntegrityGate");
if (!sfn.States.InvokeDomainWriter) throw new Error("missing InvokeDomainWriter");
if (!sfn.States.WaitBeforeResume) throw new Error("missing durable resume loop");

console.log("Vaquar bridge tests passed");
console.log(`  mesh product: ${mesh.metadata.product_id}`);
console.log(`  SFN states: ${Object.keys(sfn.States).length}`);
