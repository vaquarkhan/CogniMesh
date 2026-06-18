"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const {
  assertProductionAuthConfig,
  isProductionRuntime,
} = require("../auth-production-guard");

describe("auth-production-guard", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("allows AUTH_DISABLED outside production", () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_DISABLED = "true";
    assert.doesNotThrow(() => assertProductionAuthConfig());
  });

  it("rejects AUTH_DISABLED in production", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_DISABLED = "true";
    process.env.COGNITO_USER_POOL_ID = "pool";
    process.env.COGNITO_CLIENT_ID = "client";
    assert.throws(() => assertProductionAuthConfig(), /AUTH_DISABLED=true is not allowed/);
  });

  it("requires Cognito env in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_DISABLED;
    assert.throws(() => assertProductionAuthConfig(), /COGNITO_USER_POOL_ID/);
  });

  it("isProductionRuntime reflects NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    assert.equal(isProductionRuntime(), true);
    process.env.NODE_ENV = "test";
    assert.equal(isProductionRuntime(), false);
  });
});
