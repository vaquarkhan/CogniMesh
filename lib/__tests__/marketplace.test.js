#!/usr/bin/env node
"use strict";

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const {
  searchMarketplace,
  featuredProducts,
  getMarketplaceProduct,
  marketplaceCatalog,
  enrichProduct,
} = require("../marketplace");
const { registerProduct, patchProductTrust } = require("../catalog-client");
const { trustFromProof } = require("../vrp/product-trust");

describe("marketplace API facade", () => {
  before(async () => {
    process.env.CATALOG_STORAGE = "memory";
    const reg = await registerProduct({
      name: "orders-gold",
      domain: "commerce",
      version: "1.0.0",
      integrityGatePassed: true,
      description: "Proof-gated orders gold",
      manifestYaml: "metadata:\n  name: orders-gold\nspec:\n  transform:\n    pvdm:\n      qualityPolicyId: strict\n",
    });
    const trust = trustFromProof({
      verdict: "PASS",
      conformance_profile: "A",
      iceberg_snapshot_id: "1001",
      source_snapshot_id: "src-1",
      schema_fingerprint: "abc",
      signed_at: new Date().toISOString(),
    });
    patchProductTrust(reg.product.id, trust);
  });

  it("marketplaceCatalog lists discovery endpoints", () => {
    const cat = marketplaceCatalog();
    assert.match(cat.name, /Marketplace/);
    assert.ok(cat.endpoints.some((e) => e.path.includes("/marketplace/products")));
  });

  it("enrichProduct attaches trust and links", () => {
    const p = enrichProduct({ id: "x", name: "x", domain: "d", tags: { vrpVerdict: "PASS", proofGated: "true" } });
    assert.ok(p.trust);
    assert.ok(p.links.consumerDetail.includes("/consumer-detail"));
  });

  it("searchMarketplace ranks by trust and supports filters", async () => {
    const all = await searchMarketplace({}, { sort: "trust" });
    assert.equal(all.status, "success");
    assert.ok(all.total >= 1);
    assert.ok(all.products[0].trust?.score >= 0);

    const filtered = await searchMarketplace({}, { q: "orders", grade: "A", proofGated: "true" });
    assert.equal(filtered.status, "success");
    assert.ok(filtered.products.every((p) => /orders/i.test(p.name)));
  });

  it("featuredProducts returns a shortlist", async () => {
    const feat = await featuredProducts({}, { limit: 3 });
    assert.equal(feat.status, "success");
    assert.ok(feat.products.length >= 1);
    assert.ok(feat.products.length <= 3);
  });

  it("getMarketplaceProduct returns actions for consumers", async () => {
    const listed = await searchMarketplace({}, { q: "orders-gold" });
    const id = listed.products[0].id;
    const detail = await getMarketplaceProduct(id, { sub: "user-1" });
    assert.equal(detail.status, "success");
    assert.ok(detail.actions.requestAccess.path.includes(id));
    assert.ok(detail.actions.verifyProof.path.includes("/proofs/verify"));
  });
});
