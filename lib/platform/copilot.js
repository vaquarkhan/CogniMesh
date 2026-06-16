"use strict";

const { listRuns } = require("../execution-history");

function copilotRespond({ message, pipelineName, domain }) {
  const text = (message || "").toLowerCase();
  const runs = listRuns({ pipelineName, domain, limit: 5 });
  const last = runs[0];

  if (/vrp|fail|verification/.test(text)) {
    return {
      reply: last
        ? `Latest run (${last.ts}): outcome=${last.outcome}, VRP=${last.vrpVerdict || "n/a"}. Check integrity gate rules and SparkRules policy ${last.qualityPolicyId || "default"}.`
        : "No runs yet. Deploy once to capture VRP proof in Run History.",
      suggestions: ["Open Run History", "Review integrity gate YAML", "Enable quarantine lane"],
    };
  }

  if (/cost|expensive|glue/.test(text)) {
    return {
      reply: "Open the Cost dashboard in Operations to see Glue vs Step Functions breakdown. Consider Iceberg compaction and right-sizing DPU hours.",
      suggestions: ["View cost attribution", "Switch to batch layer only"],
    };
  }

  if (/rollback|version/.test(text)) {
    return {
      reply: "Use Operations → Versions to rollback to a prior deploy snapshot, then redeploy from the restored canvas.",
      suggestions: ["List pipeline versions", "Rollback to v1.0.0"],
    };
  }

  return {
    reply: "I can help debug VRP failures, cost, rollback, and deploy impact. Try: 'Why did VRP fail?' or 'Show impact of schema change'.",
    suggestions: ["Explain last deploy", "Health score for this pipeline", "Impact analysis"],
  };
}

module.exports = { copilotRespond };
