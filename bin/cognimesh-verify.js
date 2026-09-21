#!/usr/bin/env node
"use strict";

/**
 * cognimesh-verify — standalone offline VRP proof verifier.
 *
 *   cognimesh-verify proof.json
 *   cognimesh-verify proof.json --public-key steward.pem
 *   cognimesh-verify proof.json --key-url http://localhost:4000/.well-known/cognimesh-steward-keys.json
 *   cognimesh-verify proof.json --require-signature
 */

const fs = require("fs");
const path = require("path");
const { verifyVrpProof } = require("../lib/vrp/verify");
const { fetchPublicKeyFromRegistry } = require("../lib/vrp/steward-keys-public");

function usage() {
  console.error(`Usage: cognimesh-verify <proof.json> [options]

Options:
  --public-key <path.pem>   Steward/producer public key PEM
  --key-url <url>           Fetch key from steward registry / .well-known JSON
  --key-id <id>             Prefer this keyId when using --key-url
  --at <iso>                Evaluate validity window at this timestamp (fixture demos)
  --require-signature       Fail if proof has no signature
  --json                    Print full JSON result
  -h, --help                Show help

Exit: 0 valid · 1 invalid · 2 usage error
Docs: docs/VERIFY.md`);
}

function parseArgs(argv) {
  const out = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      out.flags.help = true;
    } else if (a === "--require-signature" || a === "--json") {
      out.flags[a.slice(2)] = true;
    } else if (a.startsWith("--") && i + 1 < argv.length) {
      out.flags[a.slice(2)] = argv[i + 1];
      i += 1;
    } else if (!a.startsWith("--")) {
      out.positional.push(a);
    }
  }
  return out;
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    usage();
    process.exit(0);
  }

  const proofPath = positional[0];
  if (!proofPath) {
    usage();
    process.exit(2);
  }

  const proof = JSON.parse(fs.readFileSync(path.resolve(proofPath), "utf8"));
  const options = { requireSignature: Boolean(flags["require-signature"]) };

  if (flags["public-key"]) {
    options.publicKeyPem = fs.readFileSync(path.resolve(flags["public-key"]), "utf8");
  } else if (flags["key-url"]) {
    const fetched = await fetchPublicKeyFromRegistry(flags["key-url"], {
      keyId: flags["key-id"] || proof.signing?.keyId || null,
      epoch: proof.signing?.key_epoch || null,
    });
    if (!fetched.publicKeyPem) {
      console.error(JSON.stringify({ valid: false, reason: fetched.reason || "key registry fetch failed" }, null, 2));
      process.exit(1);
    }
    options.publicKeyPem = fetched.publicKeyPem;
  }

  if (flags.at) {
    options.now = flags.at;
  }

  const result = verifyVrpProof(proof, options);
  const out = {
    valid: result.valid,
    verdict: result.verdict,
    reason: result.reason || null,
    proof_id: proof.proof_id || null,
    keyId: result.signature?.keyId || proof.signing?.keyId || null,
  };
  console.log(JSON.stringify(flags.json ? { ...out, checks: result.checks } : out, null, 2));
  process.exit(result.valid ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ valid: false, reason: err.message }, null, 2));
  process.exit(1);
});
