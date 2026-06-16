"use strict";

const { listRuns, stats } = require("../execution-history");

function getLiveDashboard({ limit = 50 } = {}) {
  const runs = listRuns({ limit });
  const byPipeline = new Map();

  for (const run of runs) {
    const key = `${run.domain || "?"}/${run.pipelineName || "?"}`;
    if (!byPipeline.has(key)) {
      byPipeline.set(key, {
        domain: run.domain,
        pipelineName: run.pipelineName,
        latestStatus: run.outcome,
        latestAt: run.ts,
        runs: [],
        running: run.awsStatus === "RUNNING",
      });
    }
    const row = byPipeline.get(key);
    row.runs.push(run);
    if (run.ts > row.latestAt) {
      row.latestAt = run.ts;
      row.latestStatus = run.outcome;
      row.running = run.awsStatus === "RUNNING";
    }
  }

  const pipelines = [...byPipeline.values()].map((p) => ({
    ...p,
    runCount: p.runs.length,
    lastAwsStatus: p.runs[0]?.awsStatus || null,
    lastExecutionArn: p.runs[0]?.awsExecutionArn || null,
  }));

  const summary = stats();
  return {
    summary: {
      ...summary,
      running: pipelines.filter((p) => p.running).length,
      pipelines: pipelines.length,
    },
    pipelines,
    recentRuns: runs.slice(0, 15),
    refreshedAt: new Date().toISOString(),
  };
}

module.exports = { getLiveDashboard };
