#!/usr/bin/env node
/**
 * Build and upload cognimesh Python package to PyPI.
 *
 * Usage:
 *   node scripts/publish-pypi.js [version]
 *
 * Requires:
 *   pip install build twine
 *   TWINE_USERNAME=__token__ TWINE_PASSWORD=<pypi-api-token>
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pythonDir = path.join(root, "python");
const version = process.argv[2] || process.env.VERSION || require(path.join(root, "package.json")).version;

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function setVersion(file, pattern, replacement) {
  const p = path.join(pythonDir, file);
  const text = fs.readFileSync(p, "utf8");
  fs.writeFileSync(p, text.replace(pattern, replacement));
}

console.log(`Building cognimesh v${version} for PyPI`);

setVersion("pyproject.toml", /^version = .*/m, `version = "${version}"`);
setVersion("cognimesh/__init__.py", /^__version__ = .*/m, `__version__ = "${version}"`);

run("python -m pip install --upgrade build twine");
run("python -m build", pythonDir);

if (!process.env.TWINE_PASSWORD) {
  console.log("\nSkipping upload - set TWINE_PASSWORD (PyPI API token) to publish.");
  console.log(`Artifacts ready in ${path.join(pythonDir, "dist")}`);
  process.exit(0);
}

run("python -m twine upload --non-interactive dist/*", pythonDir);
console.log(`\nPublished: pip install cognimesh==${version}`);
