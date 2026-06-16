#!/usr/bin/env node
/**
 * Build and push CogniMesh Docker images to GHCR.
 *
 * Usage:
 *   node scripts/publish-docker.js [version]
 *   VERSION=0.1.0 node scripts/publish-docker.js
 *
 * Requires: docker login ghcr.io -u USERNAME
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const version = process.argv[2] || process.env.VERSION || require(path.join(root, "package.json")).version;
const owner = (process.env.GHCR_OWNER || "vaquarkhan").toLowerCase();
const registry = process.env.GHCR_REGISTRY || "ghcr.io";

const images = [
  { name: "cognimesh-api", dockerfile: "docker/api.Dockerfile", context: "." },
  { name: "cognimesh-catalog", dockerfile: "Dockerfile", context: "services/catalog" },
  { name: "cognimesh-portal", dockerfile: "docker/portal.Dockerfile", context: "." },
];

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

console.log(`Publishing CogniMesh Docker images v${version} → ${registry}/${owner}/`);

for (const img of images) {
  const tag = `${registry}/${owner}/${img.name}:${version}`;
  const latest = `${registry}/${owner}/${img.name}:latest`;
  const dockerfile = img.context === "." ? img.dockerfile : path.join(img.context, img.dockerfile);
  run(
    `docker build -f ${dockerfile} -t ${tag} -t ${latest} ${img.context === "." ? "." : img.context}`
  );
  run(`docker push ${tag}`);
  run(`docker push ${latest}`);
}

console.log("\nDone. Pull with:");
for (const img of images) {
  console.log(`  docker pull ${registry}/${owner}/${img.name}:${version}`);
}
