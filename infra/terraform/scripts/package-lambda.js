#!/usr/bin/env node
"use strict";

/**
 * Package CogniMesh Lambda deployment zips (integrity-gate, domain-writer).
 * Stages handler + lib + rules + schemas + production node_modules, then
 * creates a Lambda-compatible zip (tar -a) with handler.js at archive root.
 *
 * Usage:
 *   node infra/terraform/scripts/package-lambda.js all
 *   node infra/terraform/scripts/package-lambda.js integrity-gate
 *   node infra/terraform/scripts/package-lambda.js domain-writer --terraform-json
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "../../..");
const buildDir = path.join(root, "infra/terraform/build");

const PACKAGES = {
  "integrity-gate": {
    zipName: "integrity-gate.zip",
    handlerDir: "services/lambda/integrity-gate",
    copies: [
      { from: "lib", to: "lib" },
      { from: "rules", to: "rules" },
      { from: "schemas", to: "schemas" },
      { from: "services/pipeline-engine/compile.js", to: "services/pipeline-engine/compile.js" },
    ],
    npm: true,
  },
  "domain-writer": {
    zipName: "domain-writer.zip",
    handlerDir: "services/lambda/domain-writer",
    copies: [
      { from: "lib", to: "lib" },
      { from: "rules", to: "rules" },
      { from: "schemas", to: "schemas" },
      { from: "services/pvdm-runtime/index.js", to: "services/pvdm-runtime/index.js" },
    ],
    npm: true,
  },
};

function copyRecursive(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.copyFileSync(src, dest);
}

function stagePackage(name, spec, { quiet = false } = {}) {
  const stageDir = path.join(buildDir, "staging", name);
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  const handlerDir = path.join(root, spec.handlerDir);
  for (const entry of fs.readdirSync(handlerDir)) {
    if (entry === "node_modules") continue;
    copyRecursive(path.join(handlerDir, entry), path.join(stageDir, entry));
  }

  for (const item of spec.copies) {
    copyRecursive(path.join(root, item.from), path.join(stageDir, item.to));
  }

  if (spec.npm) {
    execSync("npm install --omit=dev --no-audit --no-fund", {
      cwd: stageDir,
      stdio: quiet ? "pipe" : "inherit",
    });
  }

  return stageDir;
}

function createZip(stageDir, zipPath, { quiet = false } = {}) {
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`tar -a -c -f ${JSON.stringify(zipPath)} -C ${JSON.stringify(stageDir)} .`, {
    stdio: quiet ? "pipe" : "inherit",
  });
}

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("base64");
}

function packageOne(name, { terraformJson = false } = {}) {
  const spec = PACKAGES[name];
  if (!spec) {
    throw new Error(`Unknown package: ${name}`);
  }

  const stageDir = stagePackage(name, spec, { quiet: terraformJson });
  const zipPath = path.join(buildDir, spec.zipName);
  createZip(stageDir, zipPath, { quiet: terraformJson });

  const result = {
    name,
    path: zipPath,
    hash: sha256File(zipPath),
  };

  if (terraformJson) {
    process.stdout.write(
      JSON.stringify({
        path: path.relative(path.join(root, "infra/terraform/environments/prod"), zipPath).replace(/\\/g, "/"),
        hash: result.hash,
      })
    );
    return result;
  }

  console.log(`Built ${zipPath}`);
  return result;
}

function main() {
  const args = process.argv.slice(2);
  const terraformJson = args.includes("--terraform-json");
  const names = args.filter((a) => !a.startsWith("--"));
  const targets = names.length === 0 || names.includes("all") ? Object.keys(PACKAGES) : names;

  if (terraformJson && targets.length !== 1) {
    console.error("--terraform-json requires exactly one package name");
    process.exit(1);
  }

  const built = targets.map((name) => packageOne(name, { terraformJson }));
  return built;
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
