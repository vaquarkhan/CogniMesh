"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const REPO_ROOT = path.join(__dirname, "..");

/**
 * Load repo-root .env; fall back to .env.example when .env is missing (local dev).
 * Does not overwrite variables already set in the process environment.
 */
function loadRepoEnv({ root = REPO_ROOT } = {}) {
  const envPath = path.join(root, ".env");
  const examplePath = path.join(root, ".env.example");

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    return { path: envPath, source: "env" };
  }

  if (fs.existsSync(examplePath)) {
    dotenv.config({ path: examplePath });
    console.warn(
      "[cognimesh] No .env file found — loaded defaults from .env.example. Copy to .env to customize: cp .env.example .env"
    );
    return { path: examplePath, source: "example" };
  }

  return { path: null, source: "none" };
}

module.exports = { loadRepoEnv, REPO_ROOT };
