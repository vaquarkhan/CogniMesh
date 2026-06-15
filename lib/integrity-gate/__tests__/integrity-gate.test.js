#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { runIntegrityGate } = require("../index");

describe("integrity-gate", () => {
  it("passes valid structured contract", () => {
    const contract = {
      apiVersion: "cognimesh.io/v1",
      kind: "DataContract",
      metadata: { name: "t", domain: "commerce", version: "1.0.0", owner: { contact: "a@b.com" } },
      spec: {
        execution: { mode: "batch", pattern: "vaquar", schedule: "0 0 * * *" },
        source: { type: "rds", connection: { secretArn: "arn:aws:secretsmanager:us-east-1:1:secret:x" } },
        transform: { type: "spark_sql", sparkSql: "SELECT 1" },
        target: { type: "iceberg", location: "s3://x/", catalog: { database: "d", table: "t" } },
      },
    };
    const r = runIntegrityGate(contract);
    assert.equal(r.passed, true);
  });

  it("fails agentic without compensation", () => {
    const contract = {
      apiVersion: "cognimesh.io/v1",
      kind: "DataContract",
      metadata: { name: "t", domain: "commerce", version: "1.0.0" },
      spec: {
        execution: { mode: "batch" },
        source: { type: "media_url" },
        transform: { type: "agentic", agentic: {} },
        target: { type: "iceberg", location: "s3://x/", catalog: { database: "d", table: "t" } },
      },
    };
    const r = runIntegrityGate(contract);
    assert.equal(r.passed, false);
    assert.ok(r.errors.length > 0);
  });

  it("fails missing required metadata fields", () => {
    const contract = {
      apiVersion: "cognimesh.io/v1",
      kind: "DataContract",
      metadata: { name: "", domain: "commerce", version: "bad" },
      spec: {
        execution: { mode: "batch", schedule: "0 0 * * *" },
        source: { type: "rds", connection: { secretArn: "arn:aws:secretsmanager:us-east-1:1:secret:x" } },
        transform: { type: "spark_sql", sparkSql: "SELECT 1" },
        target: { type: "iceberg", location: "s3://x/", catalog: { database: "d", table: "t" } },
      },
    };
    const r = runIntegrityGate(contract);
    assert.equal(r.passed, false);
  });

  it("rejects unsupported apiVersion at validateContract layer", () => {
    const { validateContract } = require("../../contract-builder/validate");
    const contract = {
      apiVersion: "cognimesh.io/v2",
      kind: "DataContract",
      metadata: { name: "t", domain: "commerce", version: "1.0.0", owner: { contact: "a@b.com" } },
      spec: {
        execution: { mode: "batch", schedule: "0 0 * * *" },
        source: { type: "rds", connection: { secretArn: "arn:aws:secretsmanager:us-east-1:1:secret:x" } },
        transform: { type: "spark_sql", sparkSql: "SELECT 1" },
        target: { type: "iceberg", location: "s3://x/", catalog: { database: "d", table: "t" } },
      },
    };
    const r = validateContract(contract);
    assert.equal(r.valid, false);
  });

  it("fails RDS source without Secrets Manager ARN", () => {
    const contract = {
      apiVersion: "cognimesh.io/v1",
      kind: "DataContract",
      metadata: { name: "t", domain: "commerce", version: "1.0.0", owner: { contact: "a@b.com" } },
      spec: {
        execution: { mode: "batch", pattern: "vaquar", schedule: "0 0 * * *" },
        source: { type: "rds", connection: {} },
        transform: { type: "spark_sql", sparkSql: "SELECT 1" },
        target: { type: "iceberg", location: "s3://x/", catalog: { database: "d", table: "t" } },
      },
    };
    const r = runIntegrityGate(contract);
    assert.equal(r.passed, false);
  });
});
