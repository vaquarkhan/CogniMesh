"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isAmazonQFixEnabled, buildFixPrompt } = require("../platform/amazon-q-fix");

describe("amazon-q-fix", () => {
  it("is disabled without env", () => {
    const prev = process.env.AMAZON_Q_FIX_ENABLED;
    const prevApp = process.env.AMAZON_Q_APPLICATION_ID;
    delete process.env.AMAZON_Q_FIX_ENABLED;
    delete process.env.AMAZON_Q_APPLICATION_ID;
    assert.equal(isAmazonQFixEnabled(), false);
    process.env.AMAZON_Q_FIX_ENABLED = prev;
    process.env.AMAZON_Q_APPLICATION_ID = prevApp;
  });

  it("is enabled with application id", () => {
    const prevE = process.env.AMAZON_Q_FIX_ENABLED;
    const prevA = process.env.AMAZON_Q_APPLICATION_ID;
    process.env.AMAZON_Q_FIX_ENABLED = "true";
    process.env.AMAZON_Q_APPLICATION_ID = "app-123";
    assert.equal(isAmazonQFixEnabled(), true);
    process.env.AMAZON_Q_FIX_ENABLED = prevE;
    process.env.AMAZON_Q_APPLICATION_ID = prevA;
  });

  it("buildFixPrompt includes finding title", () => {
    const prompt = buildFixPrompt(
      { title: "RDS secret", severity: "medium", message: "Missing ARN", fix: "Add ARN" },
      { steps: ["step 1"] },
      { data: { sourceType: "rds" } },
      { name: "orders", domain: "commerce" }
    );
    assert.match(prompt, /RDS secret/);
    assert.match(prompt, /Amazon Q/);
  });
});
