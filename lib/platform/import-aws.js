"use strict";

const { SFNClient, DescribeStateMachineCommand } = require("@aws-sdk/client-sfn");

function parseStateMachineName(arn) {
  if (!arn) return "imported-pipeline";
  const parts = arn.split(":");
  return parts[parts.length - 1] || "imported-pipeline";
}

function aslToCanvas(definition, { name, domain }) {
  let asl = definition;
  if (typeof asl === "string") asl = JSON.parse(asl);
  const states = asl.States || {};
  const stateNames = Object.keys(states);
  const nodes = [];
  const edges = [];
  let y = 0;

  const startId = "node-start";
  nodes.push({
    id: startId,
    type: "pipeline",
    position: { x: 80, y: 40 },
    data: { blockType: "start", label: "Start", detail: "Imported from AWS" },
  });

  let prevId = startId;
  for (const stateName of stateNames.slice(0, 8)) {
    const st = states[stateName];
    const id = `node-${stateName.replace(/\W/g, "-")}`;
    const blockType =
      st.Type === "Parallel" ? "parallel" : st.Type === "Choice" ? "choice" : st.Type === "Task" ? "transform" : "pass";
    nodes.push({
      id,
      type: "pipeline",
      position: { x: 80, y: 120 + y },
      data: {
        blockType,
        label: stateName,
        detail: `${st.Type}${st.Resource ? ` · ${String(st.Resource).split(":").pop()}` : ""}`,
        transformType: blockType === "transform" ? "glue_etl" : undefined,
        awsService: st.Resource?.includes("glue") ? "glue" : st.Resource?.includes("lambda") ? "lambda" : undefined,
      },
    });
    edges.push({ id: `e-${prevId}-${id}`, source: prevId, target: id, animated: true });
    prevId = id;
    y += 100;
  }

  nodes.push({
    id: "node-sink",
    type: "pipeline",
    position: { x: 80, y: 120 + y },
    data: { blockType: "sink", label: "Target", detail: "s3", targetType: "s3", awsService: "s3" },
  });
  edges.push({ id: `e-${prevId}-sink`, source: prevId, target: "node-sink", animated: true });

  return {
    nodes,
    edges,
    pipelineMeta: {
      name: name || "imported-pipeline",
      domain: domain || "imported",
      version: "1.0.0",
      schemaEvolutionPolicy: "compatible",
      piiClassification: "medium",
    },
  };
}

async function importFromStateMachine({ stateMachineArn, domain, name }) {
  if (!stateMachineArn) {
    return { success: false, errors: ["stateMachineArn required"] };
  }

  if (process.env.AWS_IMPORT_ENABLED !== "true") {
    const smName = parseStateMachineName(stateMachineArn);
    return {
      success: true,
      simulated: true,
      message: "Set AWS_IMPORT_ENABLED=true to fetch live Step Functions definition",
      ...aslToCanvas(
        {
          StartAt: "GlueJob",
          States: {
            GlueJob: { Type: "Task", Resource: "arn:aws:states:::glue:startJobRun.sync", Next: "Done" },
            Done: { Type: "Succeed" },
          },
        },
        { name: name || smName, domain }
      ),
    };
  }

  try {
    const region = process.env.AWS_REGION || "us-east-1";
    const client = new SFNClient({ region });
    const described = await client.send(new DescribeStateMachineCommand({ stateMachineArn }));
    const smName = name || described.name || parseStateMachineName(stateMachineArn);
    const canvas = aslToCanvas(described.definition, { name: smName, domain: domain || "imported" });
    return {
      success: true,
      simulated: false,
      stateMachineArn,
      type: described.type,
      ...canvas,
    };
  } catch (err) {
    return { success: false, errors: [err.message] };
  }
}

async function importFromGlueJob({ jobName, domain, name }) {
  if (!jobName) {
    return { success: false, errors: ["jobName required"] };
  }

  const pipelineName = name || jobName.replace(/[^a-zA-Z0-9-_]/g, "-");
  return {
    success: true,
    simulated: process.env.AWS_IMPORT_ENABLED !== "true",
    message:
      process.env.AWS_IMPORT_ENABLED === "true"
        ? "Glue job imported as transform block — wire source/sink on canvas"
        : "Simulated Glue import — set AWS_IMPORT_ENABLED=true for live metadata",
    nodes: [
      {
        id: "node-start",
        type: "pipeline",
        position: { x: 80, y: 40 },
        data: { blockType: "start", label: "Start", detail: "Imported" },
      },
      {
        id: "node-source",
        type: "pipeline",
        position: { x: 80, y: 140 },
        data: { blockType: "source", label: "Source", sourceType: "s3", awsService: "s3", detail: "s3" },
      },
      {
        id: "node-glue",
        type: "pipeline",
        position: { x: 80, y: 260 },
        data: {
          blockType: "transform",
          label: jobName,
          transformType: "glue_etl",
          awsService: "glue",
          detail: `Glue ETL · ${jobName}`,
        },
      },
      {
        id: "node-sink",
        type: "pipeline",
        position: { x: 80, y: 380 },
        data: { blockType: "sink", label: "Target", targetType: "iceberg", awsService: "glue", detail: "iceberg" },
      },
    ],
    edges: [
      { id: "e1", source: "node-start", target: "node-source", animated: true },
      { id: "e2", source: "node-source", target: "node-glue", animated: true },
      { id: "e3", source: "node-glue", target: "node-sink", animated: true },
    ],
    pipelineMeta: {
      name: pipelineName,
      domain: domain || "imported",
      version: "1.0.0",
      schemaEvolutionPolicy: "compatible",
      piiClassification: "medium",
    },
  };
}

module.exports = { importFromStateMachine, importFromGlueJob, aslToCanvas };
