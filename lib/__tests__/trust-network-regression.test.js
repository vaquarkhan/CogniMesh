#!/usr/bin/env node
"use strict";

/**
 * Regression suite for trust-network surfaces shipped on the marketplace/proof PR:
 * conformance fixtures, steward keys, trust rubric, featured freshness demotion,
 * subscription token env gate, schema rename detection, LF simulate path.
 */
process.env.VRP_SIGN_ON_GENERATE = "false";
process.env.VRP_GATEWAY_SECRET = "regression-gateway-secret";
process.env.CATALOG_STORAGE = "memory";
delete process.env.LAKE_FORMATION_GRANT_ENABLED;
delete process.env.VRP_REQUIRE_SUBSCRIPTION_TOKEN;
delete process.env.MARKETPLACE_FEATURED_REQUIRE_FRESH;

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const { verifyVrpProof } = require("../vrp/verify");
const { productTrust, TRUST_RUBRIC } = require("../vrp/product-trust");
const { stewardKeyManifest, selectPublicKey } = require("../vrp/steward-keys-public");
const {
  mintSubscriptionToken,
  verifySubscriptionToken,
} = require("../vrp/subscription-token");
const { serveProofGatedDataset, ProofGatewayError } = require("../vrp/proof-gateway");
const { grantConsumerSelect } = require("../aws/lake-formation-grant");
const { diffProductSchemas } = require("../marketplace/schema-diff");
const { featuredProducts, enrichProduct } = require("../marketplace");
const { registerProduct, patchProductTrust } = require("../catalog-client");
const { trustFromProof } = require("../vrp/product-trust");

function midWindow(proof) {
  const start = new Date(proof.not_before).getTime();
  const end = new Date(proof.not_after).getTime();
  return new Date(start + Math.floor((end - start) / 2)).toISOString();
}

describe("proof trust-network regressions", () => {
  it("conformance PASS fixtures verify at mid-window; tampered fail", () => {
    const dir = path.join(__dirname, "../../fixtures/vrp-conformance");
    for (const file of ["identity-pass.json", "aggregate-pass.json"]) {
      const proof = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      const result = verifyVrpProof(proof, { requireSignature: false, now: midWindow(proof) });
      assert.equal(result.valid, true, `${file}: ${result.reason}`);
    }
    for (const file of ["identity-tampered.json", "aggregate-tampered.json"]) {
      const proof = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      const result = verifyVrpProof(proof, { requireSignature: false, now: midWindow(proof) });
      assert.equal(result.valid, false, `${file} should fail`);
    }
  });

  it("npm run verify:conformance exits 0 (no wall-clock rot)", () => {
    const res = spawnSync("npm", ["run", "verify:conformance"], {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf8",
      shell: true,
    });
    assert.equal(res.status, 0, res.stderr || res.stdout);
    assert.match(res.stdout, /All 4 conformance vectors passed/);
  });

  it("TRUST_RUBRIC B→A path matches productTrust scoring", () => {
    const gradeB = productTrust({
      proofGated: true,
      vrpVerdict: "PASS",
      conformanceProfile: "A",
    });
    assert.equal(gradeB.score, 60);
    assert.equal(gradeB.grade, "B");

    const gradeA = productTrust({
      proofGated: true,
      vrpVerdict: "PASS",
      conformanceProfile: "A",
      icebergSnapshotId: "1001",
      schemaFingerprint: "abc",
      lastProofAt: new Date().toISOString(),
    });
    assert.ok(gradeA.score >= TRUST_RUBRIC.grades.find((g) => g.grade === "A").minScore);
    assert.equal(gradeA.grade, "A");
    assert.match(TRUST_RUBRIC.gradeBtoA.typical, /grade A/);
  });

  it("steward key manifest never exposes multiset HMAC material", () => {
    process.env.PVDM_STEWARD_PUBLIC_KEY_PEM =
      "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAregressiontestkeyplaceholderxxxxxxxxxxxx=\n-----END PUBLIC KEY-----";
    process.env.PVDM_STEWARD_PUBLIC_KEY_ID = "test-steward";
    const manifest = stewardKeyManifest();
    assert.equal(manifest.issuer, "cognimesh-steward");
    assert.ok(Array.isArray(manifest.keys));
    assert.ok(manifest.honesty.some((h) => /HMAC/i.test(h)));
    const selected = selectPublicKey(manifest, { keyId: "test-steward" });
    assert.ok(selected?.publicKeyPem?.includes("BEGIN PUBLIC KEY"));
    delete process.env.PVDM_STEWARD_PUBLIC_KEY_PEM;
    delete process.env.PVDM_STEWARD_PUBLIC_KEY_ID;
  });

  it("VRP_REQUIRE_SUBSCRIPTION_TOKEN forces subscription check without productId", async () => {
    process.env.VRP_REQUIRE_SUBSCRIPTION_TOKEN = "true";
    try {
      await assert.rejects(
        () =>
          serveProofGatedDataset({
            sessionId: "sess-env",
            proof: {
              proof_version: "3",
              proof_id: "x",
              verdict: "PASS",
              not_before: new Date().toISOString(),
              not_after: new Date(Date.now() + 3600000).toISOString(),
            },
          }),
        (err) => err instanceof ProofGatewayError && err.code === "SUBSCRIPTION_TOKEN_DENIED"
      );
    } finally {
      delete process.env.VRP_REQUIRE_SUBSCRIPTION_TOKEN;
    }
  });

  it("subscription token product mismatch is denied", () => {
    const minted = mintSubscriptionToken({ product_id: "p-a", iceberg_snapshot_id: "1" });
    const check = verifySubscriptionToken(minted.token, { productId: "p-b" });
    assert.equal(check.valid, false);
    assert.match(check.reason, /product mismatch/);
  });

  it("schema-diff reports possible renames as breaking until confirmed", () => {
    const diff = diffProductSchemas({
      left: [{ name: "cust_id", type: "string" }],
      right: [{ name: "customer_id", type: "string" }],
    });
    assert.equal(diff.breaking, true);
    assert.ok(diff.schema.possibleRenames.some((r) => r.from === "cust_id" && r.to === "customer_id"));
  });

  it("grantConsumerSelect reports missing database/table clearly", async () => {
    const grant = await grantConsumerSelect({
      principalArn: "arn:aws:iam::123456789012:role/x",
      database: "",
      table: "",
    });
    assert.equal(grant.granted, false);
    assert.match(grant.note, /Missing Glue/i);
  });
});

describe("featured freshness demotion", () => {
  let freshId;
  let staleId;

  before(async () => {
    process.env.CATALOG_STORAGE = "memory";
    process.env.MARKETPLACE_FEATURED_REQUIRE_FRESH = "true";

    const fresh = await registerProduct({
      name: "fresh-gold",
      domain: "commerce",
      version: "1.0.0",
      integrityGatePassed: true,
      description: "fresh",
    });
    freshId = fresh.product.id;
    patchProductTrust(
      freshId,
      trustFromProof({
        verdict: "PASS",
        conformance_profile: "A",
        iceberg_snapshot_id: "1",
        source_snapshot_id: "s1",
        schema_fingerprint: "f",
        signed_at: new Date().toISOString(),
      })
    );

    const stale = await registerProduct({
      name: "stale-gold",
      domain: "commerce",
      version: "1.0.0",
      integrityGatePassed: true,
      description: "stale",
    });
    staleId = stale.product.id;
    patchProductTrust(
      staleId,
      trustFromProof({
        verdict: "PASS",
        conformance_profile: "A",
        iceberg_snapshot_id: "2",
        source_snapshot_id: "s2",
        schema_fingerprint: "f",
        signed_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      })
    );
  });

  it("featuredProducts excludes SLA_STALE when requireFresh is on", async () => {
    const staleEnriched = enrichProduct({
      id: staleId,
      name: "stale-gold",
      domain: "commerce",
      trust: trustFromProof({
        verdict: "PASS",
        conformance_profile: "A",
        iceberg_snapshot_id: "2",
        signed_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      }),
    });
    assert.equal(staleEnriched.sla?.stale, true);

    const feat = await featuredProducts({}, { limit: 20 });
    assert.equal(feat.status, "success");
    assert.ok(feat.products.every((p) => !p.sla?.stale), "featured must not include stale");
    assert.ok(feat.products.some((p) => p.id === freshId || p.name === "fresh-gold"));
  });
});

describe("demo:proof smoke", () => {
  it("scripts/demo-proof.js produces a verifiable PASS proof", () => {
    const res = spawnSync("node", ["scripts/demo-proof.js"], {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf8",
      env: { ...process.env, VRP_SIGN_ON_GENERATE: "false", GLUE_ICEBERG_ENABLED: "false" },
    });
    assert.equal(res.status, 0, res.stderr || res.stdout);
    assert.match(res.stdout, /"verdict": "PASS"/);
    const proofPath = path.join(__dirname, "../../.demo-proof.json");
    assert.ok(fs.existsSync(proofPath));
    const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
    const verified = verifyVrpProof(proof, { requireSignature: false });
    assert.equal(verified.valid, true, verified.reason);

    const cli = spawnSync("node", ["bin/cognimesh-verify.js", proofPath], {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf8",
    });
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    assert.match(cli.stdout, /"valid": true/);
  });
});
