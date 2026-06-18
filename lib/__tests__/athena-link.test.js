"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { athenaConsoleUrl } = require("../athena-link");

describe("athena-link", () => {
  it("builds console URL for valid Glue identifiers", () => {
    const url = athenaConsoleUrl({ database: "cognimesh_mesh", table: "portal_output" });
    assert.match(url, /console\.aws\.amazon\.com\/athena/);
    assert.match(url, /cognimesh_mesh/);
    assert.match(url, /portal_output/);
  });

  it("rejects SQL injection in database name", () => {
    assert.throws(
      () => athenaConsoleUrl({ database: 'foo"; DROP TABLE x; --', table: "safe_table" }),
      /Invalid database/
    );
  });

  it("rejects SQL injection in table name", () => {
    assert.throws(
      () => athenaConsoleUrl({ database: "safe_db", table: "evil\"; SELECT * FROM secrets" }),
      /Invalid table/
    );
  });

  it("rejects empty identifiers", () => {
    assert.throws(() => athenaConsoleUrl({ database: "", table: "t" }), /Invalid database/);
    assert.throws(() => athenaConsoleUrl({ database: "d", table: "" }), /Invalid table/);
  });
});
