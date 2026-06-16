#!/usr/bin/env node
"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { loadRepoEnv } = require("../load-env");

describe("loadRepoEnv", () => {
  let tmp;
  let prev;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cognimesh-env-"));
    prev = process.env.LOAD_ENV_TEST_FLAG;
    delete process.env.LOAD_ENV_TEST_FLAG;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.LOAD_ENV_TEST_FLAG;
    else process.env.LOAD_ENV_TEST_FLAG = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("loads .env when present", () => {
    fs.writeFileSync(path.join(tmp, ".env"), "LOAD_ENV_TEST_FLAG=from-env\n");
    const result = loadRepoEnv({ root: tmp });
    assert.equal(result.source, "env");
    assert.equal(process.env.LOAD_ENV_TEST_FLAG, "from-env");
  });

  it("falls back to .env.example when .env missing", () => {
    fs.writeFileSync(path.join(tmp, ".env.example"), "LOAD_ENV_TEST_FLAG=from-example\n");
    const result = loadRepoEnv({ root: tmp });
    assert.equal(result.source, "example");
    assert.equal(process.env.LOAD_ENV_TEST_FLAG, "from-example");
  });
});
