"use strict";

/**
 * Public steward signing-key distribution for offline consumers.
 * Multiset HMAC material (PVDM_STEWARD_VRP_KEY) is NEVER published here.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { stewardKeyEpoch, allowDevStewardKeys } = require("./steward-key");

function loadConfiguredPublicKeys() {
  const keys = [];
  const epoch = stewardKeyEpoch();

  const pemEnv = process.env.PVDM_STEWARD_PUBLIC_KEY_PEM;
  if (pemEnv && pemEnv.includes("BEGIN")) {
    keys.push({
      keyId: process.env.PVDM_STEWARD_PUBLIC_KEY_ID || `steward-${epoch}`,
      epoch,
      algorithm: process.env.PVDM_STEWARD_PUBLIC_KEY_ALG || "Ed25519",
      publicKeyPem: pemEnv.replace(/\\n/g, "\n"),
      status: "active",
    });
  }

  const pemPath = process.env.PVDM_STEWARD_PUBLIC_KEY_PATH;
  if (pemPath && fs.existsSync(pemPath)) {
    keys.push({
      keyId: process.env.PVDM_STEWARD_PUBLIC_KEY_ID || `steward-file-${epoch}`,
      epoch,
      algorithm: process.env.PVDM_STEWARD_PUBLIC_KEY_ALG || "Ed25519",
      publicKeyPem: fs.readFileSync(pemPath, "utf8"),
      status: "active",
    });
  }

  const registryPath =
    process.env.PVDM_STEWARD_KEY_REGISTRY ||
    path.join(process.cwd(), "data", "steward-keys.json");
  if (fs.existsSync(registryPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
      const list = Array.isArray(raw) ? raw : raw.keys || [];
      for (const k of list) {
        if (k.publicKeyPem) keys.push({ ...k, epoch: k.epoch || epoch });
      }
    } catch {
      /* ignore malformed registry */
    }
  }

  if (!keys.length && allowDevStewardKeys()) {
    keys.push({
      keyId: "dev-placeholder",
      epoch,
      algorithm: "Ed25519",
      publicKeyPem: null,
      status: "dev-unconfigured",
      note:
        "No PVDM_STEWARD_PUBLIC_KEY_PEM configured. Dev proofs often embed publicKeyPem in proof.signing — prefer that or set the env for offline consumers.",
    });
  }

  return keys;
}

function stewardKeyManifest() {
  const keys = loadConfiguredPublicKeys().map((k) => ({
    keyId: k.keyId,
    epoch: k.epoch,
    algorithm: k.algorithm || "Ed25519",
    status: k.status || "active",
    publicKeyPem: k.publicKeyPem || null,
    note: k.note || undefined,
    revoked: k.status === "revoked",
  }));

  return {
    issuer: "cognimesh-steward",
    version: "1",
    epoch: stewardKeyEpoch(),
    updated_at: new Date().toISOString(),
    keys,
    honesty: [
      "Only signing public keys are published — multiset HMAC keys stay steward-private",
      "Prefer keyId + epoch match from proof.signing when selecting a key",
      "Revoked keys remain listed with status=revoked for audit",
    ],
    verify_cli: "cognimesh-verify proof.json --key-url <this-url>",
  };
}

function selectPublicKey(manifest, { keyId, epoch } = {}) {
  const keys = (manifest.keys || []).filter((k) => k.publicKeyPem && k.status !== "revoked");
  if (keyId) {
    const match = keys.find((k) => k.keyId === keyId);
    if (match) return match;
  }
  if (epoch) {
    const match = keys.find((k) => k.epoch === epoch);
    if (match) return match;
  }
  return keys.find((k) => k.status === "active") || keys[0] || null;
}

async function fetchPublicKeyFromRegistry(url, options = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return { publicKeyPem: null, reason: `key registry HTTP ${res.status}` };
    }
    const manifest = await res.json();
    const selected = selectPublicKey(manifest, options);
    if (!selected?.publicKeyPem) {
      return { publicKeyPem: null, reason: "no matching active public key in registry", manifest };
    }
    return {
      publicKeyPem: selected.publicKeyPem,
      keyId: selected.keyId,
      epoch: selected.epoch,
      algorithm: selected.algorithm,
      manifest,
    };
  } catch (err) {
    return { publicKeyPem: null, reason: err.message };
  }
}

function fingerprintPem(pem) {
  if (!pem) return null;
  return crypto.createHash("sha256").update(pem).digest("hex").slice(0, 16);
}

module.exports = {
  stewardKeyManifest,
  loadConfiguredPublicKeys,
  selectPublicKey,
  fetchPublicKeyFromRegistry,
  fingerprintPem,
};
