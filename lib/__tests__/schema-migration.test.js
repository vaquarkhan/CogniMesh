#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validateContract } = require("../contract-builder/validate");
const { catalogStorageMode, fallbackEnabled } = require("../catalog-client");

describe("schema migration / env", () => {
  it("validateContract rejects cognimesh.io/v2", () => {
    const r = validateContract({
      apiVersion: "cognimesh.io/v2",
      kind: "DataContract",
      metadata: { name: "x", domain: "d", version: "1.0.0", owner: { contact: "a@b.com" } },
      spec: {
        execution: { mode: "batch", schedule: "0 0 * * *" },
        source: { type: "rds", connection: { secretArn: "arn:aws:secretsmanager:us-east-1:1:secret:x" } },
        transform: { type: "spark_sql", sparkSql: "SELECT 1" },
        target: { type: "iceberg", location: "s3://x/", catalog: { database: "d", table: "t" } },
      },
    });
    assert.equal(r.valid, false);
  });

  it("CATALOG_STORAGE=memory enables embedded fallback", () => {
    const prev = process.env.CATALOG_STORAGE;
    process.env.CATALOG_STORAGE = "memory";
    delete process.env.CATALOG_FALLBACK;
    assert.equal(catalogStorageMode(), "embedded");
    assert.equal(fallbackEnabled(), true);
    if (prev === undefined) delete process.env.CATALOG_STORAGE;
    else process.env.CATALOG_STORAGE = prev;
  });
});
