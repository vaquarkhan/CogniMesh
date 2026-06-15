#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { designPipelineFromMessage, matchPatternFromMessage } = require("../ai-pipeline-designer");

describe("ai-pipeline-designer", () => {
  it("matches CDC intent to vaquar pattern", () => {
    assert.equal(matchPatternFromMessage("RDS CDC orders into iceberg"), "vaquar-cdc-orders");
  });

  it("matches medallion keywords", () => {
    assert.equal(matchPatternFromMessage("bronze silver gold medallion lakehouse"), "medallion-full-stack");
  });

  it("designPipelineFromMessage returns pattern id", () => {
    const r = designPipelineFromMessage("Build a RAG knowledge base from PDF documents");
    assert.equal(r.success, true);
    assert.equal(r.patternId, "genai-rag-documents");
  });
});
