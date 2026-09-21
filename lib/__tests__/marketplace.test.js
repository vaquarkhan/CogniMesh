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
  issueSubscriptionToken,
  schemaDiffProduct,
  diffProductSchemas,
} = require("../marketplace");
const { registerProduct, patchProductTrust } = require("../catalog-client");
const { trustFromProof } = require("../vrp/product-trust");
const { requestAccess, approveRequest } = require("../access-requests");
const { verifySubscriptionToken } = require("../vrp/subscription-token");
const { grantConsumerSelect, catalogFromProduct } = require("../aws/lake-formation-grant");
const {
  subscribeSla,
  evaluateAndNotifySla,
  _resetSlaSubscriptionsForTests,
} = require("../platform/sla-marketplace");

describe("marketplace API facade", () => {
  let productId;

  before(async () => {
    process.env.CATALOG_STORAGE = "memory";
    process.env.VRP_GATEWAY_SECRET = "test-marketplace-secret";
    delete process.env.LAKE_FORMATION_GRANT_ENABLED;
    delete process.env.ALERT_WEBHOOK_URL;
    _resetSlaSubscriptionsForTests();

    const reg = await registerProduct({
      name: "orders-gold",
      domain: "commerce",
      version: "1.0.0",
      integrityGatePassed: true,
      description: "Proof-gated orders gold",
      manifestYaml:
        "metadata:\n  name: orders-gold\nspec:\n  transform:\n    pvdm:\n      qualityPolicyId: strict\n  target:\n    catalogDatabase: commerce\n    catalogTable: orders_gold\n  source:\n    schema:\n      - name: order_id\n      - name: amount\n",
    });
    productId = reg.product.id;
    const trust = trustFromProof({
      verdict: "PASS",
      conformance_profile: "A",
      iceberg_snapshot_id: "1001",
      source_snapshot_id: "src-1",
      schema_fingerprint: "abc",
      signed_at: new Date().toISOString(),
    });
    patchProductTrust(productId, trust);
  });

  it("marketplaceCatalog lists discovery endpoints", () => {
    const cat = marketplaceCatalog();
    assert.match(cat.name, /Marketplace/);
    assert.ok(cat.endpoints.some((e) => e.path.includes("/subscription-token")));
    assert.ok(cat.endpoints.some((e) => e.path.includes("/schema-diff")));
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
    const detail = await getMarketplaceProduct(productId, { sub: "user-1" });
    assert.equal(detail.status, "success");
    assert.ok(detail.actions.requestAccess.path.includes(productId));
    assert.ok(detail.actions.issueSubscriptionToken.path.includes("subscription-token"));
    assert.ok(detail.actions.schemaDiff.path.includes("schema-diff"));
  });

  it("issueSubscriptionToken requires approve + VRP PASS", async () => {
    const denied = await issueSubscriptionToken(productId, { sub: "user-1" });
    assert.equal(denied.status, "error");
    assert.equal(denied.code, "MARKETPLACE_ACCESS_REQUIRED");

    const req = requestAccess({ productId, userId: "user-1", reason: "test" });
    approveRequest(req.id, "steward-1");

    const minted = await issueSubscriptionToken(productId, { sub: "user-1" });
    assert.equal(minted.status, "success");
    assert.ok(minted.token.includes("."));
    const verified = verifySubscriptionToken(minted.token, { productId });
    assert.equal(verified.valid, true);
    assert.equal(verified.stamp.vrp_verdict, "PASS");
    assert.equal(verified.stamp.product_id, productId);
  });

  it("diffProductSchemas flags breaking removals", () => {
    const diff = diffProductSchemas({
      left: [
        { name: "order_id", type: "string" },
        { name: "amount", type: "double" },
        { name: "legacy_flag", type: "boolean" },
      ],
      right: [
        { name: "order_id", type: "string" },
        { name: "amount", type: "double" },
      ],
    });
    assert.equal(diff.breaking, true);
    assert.equal(diff.compatibility, "breaking");
    assert.ok(diff.schema.removedColumns.includes("legacy_flag"));
  });

  it("schemaDiffProduct diffs against current product when right omitted", async () => {
    const result = await schemaDiffProduct(
      productId,
      {},
      {
        left: [{ name: "order_id" }, { name: "amount" }, { name: "extra_col" }],
      }
    );
    assert.equal(result.status, "success");
    assert.equal(result.diff.breaking, true);
    assert.ok(result.diff.schema.removedColumns.includes("extra_col"));
  });

  it("grantConsumerSelect simulates when LF disabled", async () => {
    const grant = await grantConsumerSelect({
      principalArn: "arn:aws:iam::123456789012:role/consumer",
      database: "commerce",
      table: "orders_gold",
    });
    assert.equal(grant.granted, true);
    assert.equal(grant.simulated, true);
    assert.equal(grant.implemented, true);

    const catalog = catalogFromProduct({
      name: "orders_gold",
      domain: "commerce",
      manifestYaml: "catalogDatabase: commerce\ncatalogTable: orders_gold\n",
    });
    assert.equal(catalog.database, "commerce");
    assert.equal(catalog.table, "orders_gold");
  });

  it("evaluateAndNotifySla reports breach without webhook configured", async () => {
    _resetSlaSubscriptionsForTests();
    subscribeSla({ productId, consumerId: "user-1", slaMinutes: 60 });
    const staleAt = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const result = await evaluateAndNotifySla({
      productId,
      lastRunAt: staleAt,
      domain: "commerce",
      productName: "orders-gold",
    });
    assert.equal(result.compliant, false);
    assert.ok(result.breached.length >= 1);
    assert.equal(result.notified, false);
    assert.ok(result.notifications.length >= 1);
    assert.match(result.notifications[0].reason || "", /webhook not configured|slack/i);
  });
});
