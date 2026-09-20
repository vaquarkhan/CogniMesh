#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateSparkDeclarativeProject,
  generateDbtProject,
  exportProjectBundle,
  zipStore,
} = require("../export");

const contract = {
  metadata: { name: "orders-gold", domain: "commerce", version: "1.2.0" },
  spec: {
    execution: { mode: "batch" },
    source: {
      type: "rds",
      connection: { database: "orders_db", table: "orders" },
      cdc: { enabled: true, primaryKey: ["order_id"] },
    },
    transform: {
      type: "spark_sql",
      sparkSql: "SELECT order_id, customer_id, total FROM silver.orders",
      pvdm: {
        identityFields: ["order_id"],
        contentFields: ["order_id", "customer_id", "total"],
      },
    },
    target: {
      type: "iceberg",
      catalog: { database: "commerce_gold", table: "orders_daily" },
    },
  },
};

describe("SDP and dbt export", () => {
  it("generates a runnable spark-pipeline.yml with bronze/silver/gold SQL", () => {
    const out = generateSparkDeclarativeProject(contract);
    assert.equal(out.status, "success");
    assert.match(out.files["spark-pipeline.yml"], /name: orders-gold/);
    assert.match(out.files["spark-pipeline.yml"], /libraries:/);
    assert.match(out.files["transformations/03_gold.sql"], /orders_daily|SELECT order_id/);
    assert.match(out.files["README.md"], /spark-pipelines run/);
    assert.equal(out.pvdmRequired, true);
  });

  it("generates a dbt project with sources, model, and schema tests", () => {
    const out = generateDbtProject(contract);
    assert.equal(out.status, "success");
    assert.match(out.files["dbt_project.yml"], /name: 'orders_gold'|name: 'orders-gold'|orders/);
    assert.ok(out.files["models/sources.yml"]);
    assert.ok(out.files["models/orders_daily.sql"] || Object.keys(out.files).some((k) => k.endsWith(".sql") && k.startsWith("models/")));
    assert.match(out.files["README.md"], /VRP/);
  });

  it("zipStore produces a PKZIP local file header", () => {
    const buf = zipStore({ "a.txt": "hello" });
    assert.equal(buf.readUInt32LE(0), 0x04034b50);
  });

  it("exportProjectBundle returns base64 zip for SDP", () => {
    const bundle = exportProjectBundle("sdp", contract);
    assert.equal(bundle.status, "success");
    assert.ok(bundle.zipBase64.length > 20);
    assert.ok(bundle.fileCount >= 4);
  });
});
