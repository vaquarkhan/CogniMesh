"use strict";

const path = require("path");
const { graphToContract, validateGraph } = require("./graph-to-contract");
const { graphToContractSmart } = require("./graph-to-contract-smart");
const { compileGraphToStateMachine, isWorkflowGraph, validateWorkflowGraph } = require("./graph-to-workflow");
const { validateContract } = require("./validate");
const { checkApiVersionMigration } = require("../schema-migration");
const { compileContractSmart } = require("../../services/pipeline-engine/compile");
const { runIntegrityGate } = require("../integrity-gate");
const { deployStateMachine } = require("../aws/stepfunctions-deploy");
const { registerProduct } = require("../catalog-client");

const { safeYamlDump } = require("../safe-yaml");
const { generateVaquarArtifacts, isVaquarContract } = require("../vaquar");
const { evaluateSchemaEvolution } = require("../schema-evolution");
const { saveLineage, getLineageByKey, buildLineageGraph } = require("../lineage-catalog");
const { recordRun } = require("../execution-history");
const { buildPvdmRunSummary } = require("../pvdm-run-summary");
const { getExecutionStatus } = require("../aws/sfn-execution-status");

async function deployPipeline({ nodes, edges, pipelineMeta, catalogUrl, auth }) {
  const graphResult = graphToContractSmart(nodes, edges, pipelineMeta);
  if (!graphResult.success) {
    return { status: "error", stage: "graph", errors: graphResult.errors };
  }

  const { contract } = graphResult;

  const versionCheck = checkApiVersionMigration(contract);
  if (!versionCheck.allowed) {
    return { status: "error", stage: "schema_migration", errors: versionCheck.errors, contract };
  }

  const previousLineage = getLineageByKey(contract.metadata.domain, contract.metadata.name);
  if (previousLineage?.sourceSchema?.length) {
    const evolution = evaluateSchemaEvolution(
      {
        spec: {
          source: { schema: previousLineage.sourceSchema },
          schemaEvolution: previousLineage.schemaEvolution,
        },
      },
      contract
    );
    if (!evolution.allowed) {
      recordRun({
        pipelineName: contract.metadata.name,
        domain: contract.metadata.domain,
        version: contract.metadata.version,
        outcome: "schema_evolution_blocked",
        userEmail: auth?.userEmail,
      });
      return {
        status: "error",
        stage: "schema_evolution",
        errors: evolution.errors,
        warnings: evolution.warnings,
        schemaEvolution: evolution,
        contract,
      };
    }
  }

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
  let stateMachine = compiled.stateMachine;
  const vaquar = compiled.vaquar || null;

  if (isWorkflowGraph(nodes)) {
    const wf = compileGraphToStateMachine(nodes, edges, {
      name: contract.metadata.name,
      namePrefix: process.env.AWS_NAME_PREFIX || `cognimesh-${contract.metadata.domain}`,
    });
    if (wf.success) stateMachine = wf.stateMachine;
  }

  let aws = { deployed: false, reason: "Not attempted" };
  try {
    aws = await deployStateMachine(contract, stateMachine);
  } catch (err) {
    aws = { deployed: false, error: err.message };
  }

  let executionStatus = null;
  if (aws.execution?.executionArn) {
    executionStatus = await getExecutionStatus(aws.execution.executionArn);
  }

  let catalogProduct = null;
  let catalogError = null;
  let catalogSource = null;
  const manifestYaml = safeYamlDump(contract, { lineWidth: 120 });

  if (catalogUrl || process.env.CATALOG_FALLBACK !== "none") {
    try {
      const reg = await registerProduct(
        {
          name: contract.metadata.name,
          domain: contract.metadata.domain,
          version: contract.metadata.version,
          description: contract.metadata.description,
          manifestYaml,
          tags: contract.metadata.tags,
          integrityGatePassed: true,
        },
        auth || {}
      );
      catalogSource = reg.source;
      if (reg.product) {
        catalogProduct = reg.product;
      } else {
        catalogError = reg.error || "Catalog registration failed";
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

  let lineage = null;
  if (catalogProduct?.id) {
    lineage = saveLineage(catalogProduct.id, contract);
  } else {
    const fallbackId = `${contract.metadata.domain}-${contract.metadata.name}-${contract.metadata.version}`;
    lineage = saveLineage(fallbackId, contract);
  }

  const pvdmSummary = await buildPvdmRunSummary(contract);

  recordRun({
    pipelineName: contract.metadata.name,
    domain: contract.metadata.domain,
    version: contract.metadata.version,
    outcome: pvdmSummary.vrpVerdict === "PASS" ? "success" : "verification_failed",
    userEmail: auth?.userEmail,
    catalogRegistered: Boolean(catalogProduct),
    vrpPattern: contract.spec.execution?.pattern,
    ...pvdmSummary,
    awsExecutionArn: aws.execution?.executionArn || null,
    awsStateMachineArn: aws.stateMachineArn || null,
    awsStatus: executionStatus?.status || (aws.deployed ? "deployed" : "local"),
  });

  return {
    status: "success",
    contract,
    manifestYaml,
    stateMachine,
    vaquar: vaquarArtifacts,
    lineage,
    aws: { ...aws, executionStatus },
    pvdmSummary,
    integrityGate: {
      passed: true,
      ...integrityGate,
    },
    catalog: catalogProduct
      ? { registered: true, source: catalogSource, product: catalogProduct }
      : { registered: false, source: catalogSource, error: catalogError || "Catalog service not configured" },
  };
}

function buildLineagePreview(contract) {
  return buildLineageGraph(contract);
}

function previewPipeline({ nodes, edges, pipelineMeta }) {
  const graphResult = graphToContractSmart(nodes, edges, pipelineMeta);
  if (!graphResult.success) {
    return { status: "error", stage: "graph", errors: graphResult.errors };
  }

  const { contract } = graphResult;
  const versionCheck = checkApiVersionMigration(contract);
  if (!versionCheck.allowed) {
    return {
      status: "error",
      stage: "schema_migration",
      errors: versionCheck.errors,
      contract,
    };
  }
  const validation = validateContract(contract);
  const integrityGate = runIntegrityGate(contract);

  let stateMachine = null;
  let compileError = null;
  let vaquar = null;
  let workflowGraph = null;
  try {
    if (isWorkflowGraph(nodes)) {
      workflowGraph = validateWorkflowGraph(nodes, edges);
      const wf = compileGraphToStateMachine(nodes, edges, {
        name: contract.metadata.name,
        namePrefix: process.env.AWS_NAME_PREFIX || `cognimesh-${contract.metadata.domain}`,
      });
      if (wf.success) stateMachine = wf.stateMachine;
      else compileError = wf.errors?.join("; ");
    } else {
      const compiled = compileContractSmart(contract);
      stateMachine = compiled.stateMachine;
      vaquar = compiled.vaquar || null;
    }
  } catch (err) {
    compileError = err.message;
  }

  return {
    status: validation.valid && !compileError && integrityGate.passed ? "success" : "error",
    contract,
    manifestYaml: safeYamlDump(contract, { lineWidth: 120 }),
    lineage: buildLineagePreview(contract),
    validation,
    integrityGate,
    stateMachine,
    workflowGraph,
    vaquar,
    compileError,
  };
}

module.exports = {
  graphToContract,
  graphToContractSmart,
  validateGraph,
  validateWorkflowGraph,
  compileGraphToStateMachine,
  isWorkflowGraph,
  validateContract,
  deployPipeline,
  previewPipeline,
};
