/**
 * CogniMesh Pipeline Engine - compiles DataContract manifests into
 * AWS Step Functions state machine definitions.
 */
const fs = require("fs");
const yaml = require("js-yaml");
const path = require("path");
const { isVaquarContract } = require("../../lib/vaquar");
const { compileVaquarStateMachine } = require("../../lib/vaquar/pvdm-sfn");

function compile(contractPath) {
  const raw = fs.readFileSync(path.resolve(contractPath), "utf8");
  const contract = yaml.load(raw);
  return compileContract(contract);
}

function compileContractSmart(contract, options = {}) {
  const aws = options.aws || {};
  // Execute every pattern through the provisioned PVDM domain-writer runtime so the deployed
  // state machine is always valid and runnable.
  if (isVaquarContract(contract)) {
    const { generateVaquarArtifacts } = require("../../lib/vaquar");
    const vaquar = generateVaquarArtifacts(contract, aws);
    return { pattern: "vaquar-pvdm", stateMachine: vaquar.stateMachine, vaquar };
  }
  const pattern = contract.spec?.transform?.type === "agentic" ? "cognitive" : "legacy";
  return { pattern, stateMachine: compileVaquarStateMachine(contract, aws) };
}

function compileContract(contract) {
  const { metadata, spec } = contract;

  const states = buildStates(spec);

  return {
    Comment: `CogniMesh pipeline: ${metadata.name}@${metadata.version}`,
    StartAt: states[0].name,
    States: Object.fromEntries(states.map((s) => [s.name, s.definition])),
    cognimesh: {
      pipelineId: metadata.name,
      domain: metadata.domain,
      executionMode: spec.execution.mode,
      transformType: spec.transform.type,
    },
  };
}

function buildStates(spec) {
  const states = [];

  states.push({
    name: "ExtractSource",
    definition: {
      Type: "Task",
      Resource: "arn:aws:states:::glue:startJobRun.sync",
      Parameters: {
        JobName: `cognimesh-${spec.source.type}-extract`,
      },
      Next: "Transform",
    },
  });

  if (spec.transform.type === "agentic") {
    states.push({
      name: "Transform",
      definition: {
        Type: "Task",
        Resource: "arn:aws:states:::eks:runJob.sync",
        Parameters: {
          Job: {
            "metadata.name": "cognimesh-agentic-transform",
          },
        },
        Next: "LoadTarget",
      },
    });
  } else {
    states.push({
      name: "Transform",
      definition: {
        Type: "Task",
        Resource: "arn:aws:states:::glue:startJobRun.sync",
        Parameters: {
          JobName: "cognimesh-spark-transform",
        },
        Next: "LoadTarget",
      },
    });
  }

  states.push({
    name: "LoadTarget",
    definition: {
      Type: "Task",
      Resource: "arn:aws:states:::glue:startJobRun.sync",
      Parameters: {
        JobName: `cognimesh-load-${spec.target.type}`,
      },
      End: true,
    },
  });

  return states;
}

if (require.main === module) {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node compile.js <contract.yaml>");
    process.exit(1);
  }
  console.log(JSON.stringify(compile(input), null, 2));
}

module.exports = { compile, compileContract, compileContractSmart, compileVaquarStateMachine };
