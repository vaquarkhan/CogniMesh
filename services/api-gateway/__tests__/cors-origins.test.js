#!/usr/bin/env node
"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

describe("cors-origins", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.CORS_ORIGINS = "http://localhost:3000/";
    process.env.CORS_ORIGIN_SUFFIXES = ".cloudfront.net";
    delete require.cache[require.resolve("../lib/cors-origins")];
  });

  afterEach(() => {
    process.env = env;
  });

  it("matches exact origins without trailing slash", () => {
    const { isAllowedOrigin } = require("../lib/cors-origins");
    assert.equal(isAllowedOrigin("http://localhost:3000"), true);
  });

  it("matches cloudfront host via suffix", () => {
    const { isAllowedOrigin } = require("../lib/cors-origins");
    assert.equal(isAllowedOrigin("https://d1example2test3.cloudfront.net"), true);
    assert.equal(isAllowedOrigin("https://evil.example.com"), false);
  });
});
