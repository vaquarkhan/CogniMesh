"use strict";

const path = require("path");
const { graphToContract, validateGraph } = require("./graph-to-contract");
const { validateContract } = require("./validate");
const { compileContract, compileContractSmart } = require("../../services/pipeline-engine/compile");
const { runIntegrityGate } = require("../integrity-gate");
const { deployStateMachine } = require("../aws/stepfunctions-deploy");

const { generateVaquarArtifacts, isVaquarContract } = require("../vaquar");

async function deployPipeline({ nodes, edges, pipelineMeta, catalogUrl, auth }) {
  const graphResult = graphToContract(nodes, edges, pipelineMeta);
  if (!graphResult.success) {
    return { status: "error", stage: "graph", errors: graphResult.errors };
  }

  const { contract } = graphResult;
  const validation = validateContract(contract);
  if (!validation.valid) {
    return { status: "error", stage: "validation", errors: validation.errors, contract };
  }

  const integrityGate = runIntegrityGate(contract);
  if (!integrityGate.passed) {
    return {
      status: "error",
      stage: "integrity_gate",
      errors: integrityGate.errors,
      warnings: integrityGate.warnings,
      integrityGate,
      contract,
    };
  }

  const compiled = compileContractSmart(contract);
  const stateMachine = compiled.stateMachine;
  const vaquar = compiled.vaquar || null;

  let aws = { deployed: false, reason: "Not attempted" };
  try {
    aws = await deployStateMachine(contract, stateMachine);
  } catch (err) {
    aws = { deployed: false, error: err.message };
  }

  let catalogProduct = null;
  let catalogError = null;
  const yaml = require("js-yaml");
  const manifestYaml = yaml.dump(contract, { lineWidth: 120 });

  if (catalogUrl) {
    try {
      const res = await fetch(`${catalogUrl}/api/v1/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.bearerToken ? { Authorization: `Bearer ${auth.bearerToken}` } : {}),
          ...(auth?.userEmail ? { "X-CogniMesh-User": auth.userEmail } : {}),
        },
        body: JSON.stringify({
          name: contract.metadata.name,
          domain: contract.metadata.domain,
          version: contract.metadata.version,
          description: contract.metadata.description,
          manifestYaml,
          tags: contract.metadata.tags,
          integrityGatePassed: true,
        }),
      });
      if (res.ok) {
        catalogProduct = await res.json();
      } else {
        catalogError = await res.text();
      }
    } catch (err) {
      catalogError = err.message;
    }
  }

  const outputDir = path.join(
    process.cwd(),
    "generated",
    contract.metadata.domain,
    contract.metadata.name
  );
  let vaquarArtifacts = vaquar;
  if (isVaquarContract(contract)) {
    vaquarArtifacts = generateVaquarArtifacts(contract, {
      outputDir,
      namePrefix: process.env.AWS_NAME_PREFIX || `cognimesh-${contract.metadata.domain}`,
    });
  }

  return {
    status: "success",
    contract,
    manifestYaml,
    stateMachine,
    vaquar: vaquarArtifacts,
    aws,
    integrityGate: {
      passed: true,
      ...integrityGate,
    },
    catalog: catalogProduct
      ? { registered: true, product: catalogProduct }
      : { registered: false, error: catalogError || "Catalog service not configured" },
  };
}

function previewPipeline({ nodes, edges, pipelineMeta }) {
  const graphResult = graphToContract(nodes, edges, pipelineMeta);
  if (!graphResult.success) {
    return { status: "error", stage: "graph", errors: graphResult.errors };
  }

  const { contract } = graphResult;
  const validation = validateContract(contract);
  const integrityGate = runIntegrityGate(contract);
  const yaml = require("js-yaml");

  let stateMachine = null;
  let compileError = null;
  let vaquar = null;
  try {
    const compiled = compileContractSmart(contract);
    stateMachine = compiled.stateMachine;
    vaquar = compiled.vaquar || null;
  } catch (err) {
    compileError = err.message;
  }

  return {
    status: validation.valid && !compileError && integrityGate.passed ? "success" : "error",
    contract,
    manifestYaml: yaml.dump(contract, { lineWidth: 120 }),
    validation,
    integrityGate,
    stateMachine,
    vaquar,
    compileError,
  };
}

module.exports = {
  graphToContract,
  validateGraph,
  validateContract,
  deployPipeline,
  previewPipeline,
};
