#!/usr/bin/env node
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const ASSETS = path.join(ROOT, "docs", "assets");
const TUTORIALS = path.join(ROOT, "docs", "tutorials");

const DEMOS = [
  { base: "cognimesh-tutorial-demo", minMp4: 80_000 },
  { base: "cognimesh-features-demo", minMp4: 80_000 },
  { base: "cognimesh-pipeline-demo", minMp4: 80_000 },
  { base: "cognimesh-agent-demo", minMp4: 80_000 },
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function magic(file, start, expected) {
  const buf = fs.readFileSync(file);
  assert.ok(buf.length >= start + expected.length, `${file} too small for magic bytes`);
  assert.equal(buf.subarray(start, start + expected.length).toString("latin1"), expected);
}

describe("tutorial how-it-works videos", () => {
  for (const { base, minMp4 } of DEMOS) {
    it(`${base} mp4, gif, and poster exist and are real media`, () => {
      const mp4 = path.join(ASSETS, `${base}.mp4`);
      const gif = path.join(ASSETS, `${base}.gif`);
      const poster = path.join(ASSETS, `${base}-poster.png`);

      for (const file of [mp4, gif, poster]) {
        assert.ok(fs.existsSync(file), `missing ${path.relative(ROOT, file)}`);
      }

      const mp4Size = fs.statSync(mp4).size;
      assert.ok(mp4Size >= minMp4, `${base}.mp4 is ${mp4Size} bytes; expected a recorded clip`);
      assert.ok(fs.statSync(gif).size >= 50_000, `${base}.gif looks empty`);
      assert.ok(fs.statSync(poster).size >= 20_000, `${base}-poster.png looks like a blank first frame`);

      magic(mp4, 4, "ftyp");
      magic(gif, 0, "GIF8");
      magic(poster, 0, "\x89PNG");
    });
  }

  it("getting-started tutorial How it works links the platform tour", () => {
    const md = read("docs/tutorials/getting-started-ui.md");
    assert.match(md, /^## How it works/m);
    assert.match(md, /cognimesh-features-demo\.mp4/);
    assert.match(md, /cognimesh-features-demo-poster\.png/);
    assert.match(md, /cognimesh-pipeline-demo\.mp4/);
    assert.match(md, /cognimesh-agent-demo\.mp4/);
  });

  it("tutorial hub and generated pages embed how-it-works videos", () => {
    const hub = fs.readFileSync(path.join(TUTORIALS, "README.md"), "utf8");
    assert.match(hub, /How it works/);
    assert.match(hub, /cognimesh-features-demo\.mp4/);
    assert.match(hub, /cognimesh-pipeline-demo\.mp4/);
    assert.match(hub, /cognimesh-agent-demo\.mp4/);

    const pipeline = fs.readFileSync(path.join(TUTORIALS, "pipelines", "vaquar-cdc-orders.md"), "utf8");
    assert.match(pipeline, /^## How it works/m);
    assert.match(pipeline, /cognimesh-pipeline-demo\.mp4/);
    assert.match(pipeline, /cognimesh-pipeline-demo-poster\.png/);

    const agent = fs.readFileSync(path.join(TUTORIALS, "agents", "customer-support.md"), "utf8");
    assert.match(agent, /^## How it works/m);
    assert.match(agent, /cognimesh-agent-demo\.mp4/);
    assert.match(agent, /cognimesh-agent-demo-poster\.png/);
  });

  it("demo capture script still records the four tutorial clips", () => {
    const src = read("scripts/capture-portal-demo.js");
    for (const { base } of DEMOS) {
      assert.match(src, new RegExp(`"${base}"`));
    }
    assert.match(src, /runTutorialDemoFlow/);
    assert.match(src, /runFeaturesDemoFlow/);
    assert.match(src, /runPipelineDemoFlow/);
    assert.match(src, /runAgentDemoFlow/);
  });
});
