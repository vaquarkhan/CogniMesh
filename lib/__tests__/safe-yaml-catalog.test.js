#!/usr/bin/env node
"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { safeYamlLoad } = require("../safe-yaml");

describe("safe-yaml", () => {
  it("parses simple contract yaml", () => {
    const doc = safeYamlLoad("metadata:\n  name: test\n");
    assert.equal(doc.metadata.name, "test");
  });

  it("rejects oversized input", () => {
    assert.throws(() => safeYamlLoad("x".repeat(600_000), { maxBytes: 1000 }), /maximum size/);
  });

  it("rejects alias bombs", () => {
    const bomb = "a: &a [" + "*, ".repeat(20) + "*a]\n";
    assert.throws(() => safeYamlLoad(bomb), /alias/);
  });
});

describe("catalog-client embedded", () => {
  beforeEach(() => {
    process.env.CATALOG_FALLBACK = "embedded";
  });

  it("registers product in embedded store when remote fails", async () => {
    process.env.CATALOG_URL = "http://127.0.0.1:1";
    delete process.env.CATALOG_STORAGE;
    const { registerProduct, listProducts } = require("../catalog-client");
    const reg = await registerProduct({
      name: "p1",
      domain: "d",
      version: "1.0.0",
      manifestYaml: "x: 1",
      integrityGatePassed: true,
    });
    assert.equal(reg.source, "embedded");
    const list = await listProducts();
    assert.ok(list.products.length >= 1);
  });

  it("CATALOG_STORAGE=memory uses embedded store without remote", async () => {
    process.env.CATALOG_STORAGE = "memory";
    process.env.CATALOG_URL = "http://localhost:8080";
    const { registerProduct, listProducts } = require("../catalog-client");
    const reg = await registerProduct({
      name: "mem-p",
      domain: "sales",
      version: "2.0.0",
      manifestYaml: "x: 2",
      integrityGatePassed: true,
    });
    assert.equal(reg.source, "embedded");
    const list = await listProducts("sales");
    assert.ok(list.products.some((p) => p.name === "mem-p"));
  });
});
