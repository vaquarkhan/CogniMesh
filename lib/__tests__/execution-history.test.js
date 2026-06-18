#!/usr/bin/env node
"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("execution-history persistence", () => {
  const envBackup = { ...process.env };
  let dataDir;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cognimesh-runs-"));
    process.env = { ...envBackup };
    process.env.PLATFORM_DATA_DIR = dataDir;
    process.env.PLATFORM_STORE = "file";
    delete require.cache[require.resolve("../execution-history")];
    delete require.cache[require.resolve("../platform/platform-store")];
  });

  afterEach(() => {
    process.env = envBackup;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("persists runs to platform store and reloads", () => {
    const hist = require("../execution-history");
    hist.recordRun({ pipelineName: "orders", outcome: "success" });
    hist.recordRun({ pipelineName: "orders", outcome: "failed" });

    delete require.cache[require.resolve("../execution-history")];
    delete require.cache[require.resolve("../platform/platform-store")];
    const reloaded = require("../execution-history");
    const runs = reloaded.listRuns({ pipelineName: "orders", limit: 10 });
    assert.equal(runs.length, 2);
    assert.equal(runs[0].outcome, "failed");
  });
});
