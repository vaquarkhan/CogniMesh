"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { contractToMesh, isVaquarContract } = require("./contract-to-mesh");
const { compileVaquarStateMachine } = require("./pvdm-sfn");

function generateVaquarArtifacts(contract, options = {}) {
  const mesh = contractToMesh(contract, options);
  const meshYaml = yaml.dump(mesh, { lineWidth: 120 });
  const stateMachine = compileVaquarStateMachine(contract, options);

  const outputDir = options.outputDir;
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "mesh.pipeline.yaml"), meshYaml);
    fs.writeFileSync(
      path.join(outputDir, "orchestrator.asl.json"),
      JSON.stringify(stateMachine, null, 2)
    );
    fs.writeFileSync(
      path.join(outputDir, "manifest.json"),
      JSON.stringify({ pattern: "vaquar-pvdm", mesh, stateMachine }, null, 2)
    );
  }

  return {
    pattern: "vaquar-pvdm",
    outputDir: outputDir || null,
    mesh,
    meshYaml,
    stateMachine,
    phases: ["SparkRules", "IceGuard", "VRP verify", "Durable", "GlueCatalogConnector"],
  };
}

function compilePipeline(contract, options = {}) {
  if (isVaquarContract(contract) || options.forceVaquar) {
    return generateVaquarArtifacts(contract, options);
  }
  const { compileContract } = require("../../services/pipeline-engine/compile");
  return {
    pattern: "legacy-glue",
    stateMachine: compileContract(contract),
  };
}

module.exports = {
  contractToMesh,
  isVaquarContract,
  compileVaquarStateMachine,
  generateVaquarArtifacts,
  compilePipeline,
};
