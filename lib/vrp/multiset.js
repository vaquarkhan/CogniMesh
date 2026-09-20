"use strict";

const crypto = require("crypto");
const { canonicalJson, encodeHashedProjection } = require("./canonical");
const { resolveStewardVrpKey, stewardKeyEpoch } = require("./steward-key");

/** Paper §7.1: D_k(M) = (sum int(HMAC-SHA256_k(c(r)))) mod 2^256 */
const MOD = 2n ** 256n;

function projectRow(row, fields) {
  const keys = fields && fields.length ? [...fields].sort() : Object.keys(row || {}).sort();
  const projected = {};
  for (const k of keys) {
    const value = row == null ? null : row[k];
    projected[k] = value === undefined ? null : value;
  }
  return projected;
}

function canonicalRowBytes(row, fields, options = {}) {
  const projected = projectRow(row, fields);
  const encoded = encodeHashedProjection(projected, options.fieldTypes || {});
  return Buffer.from(canonicalJson(encoded), "utf8");
}

function elementHash(key, blob) {
  const digest = crypto.createHmac("sha256", key).update(blob).digest();
  return BigInt(`0x${digest.toString("hex")}`);
}

function digestToHex(acc) {
  return acc.toString(16).padStart(64, "0");
}

function hexToBigInt(hex) {
  if (!hex) return 0n;
  return BigInt(`0x${String(hex).replace(/^0x/i, "")}`);
}

/**
 * Keyed MSet-Add-Hash (Clarke et al.): order-independent, multiplicity-sensitive.
 * @param {object[]} rows
 * @param {string[]|null} fields identity or content projection; omit for full row
 * @param {{ vrpKey?: Buffer|string }} [options]
 * @returns {string} 256-bit digest as 64-char hex
 */
function hashMultiset(rows, fields, options = {}) {
  const key = resolveStewardVrpKey(options);
  let acc = 0n;
  for (const row of rows || []) {
    acc = (acc + elementHash(key, canonicalRowBytes(row, fields, options))) % MOD;
  }
  return digestToHex(acc);
}

function hashMultisetProjections(rows, identityFields, contentFields, options = {}) {
  return {
    identity: hashMultiset(rows, identityFields, options),
    content: hashMultiset(rows, contentFields, options),
    construction: "mset-add-hmac-sha256",
    key_epoch: options.keyEpoch || stewardKeyEpoch(),
  };
}

/**
 * Combine per-shard partial digests. All partials MUST share a key epoch (paper N / Finding 9).
 */
function combinePartials(partials) {
  if (!partials?.length) return digestToHex(0n);
  const epochs = new Set(partials.map((p) => p.epoch || p.key_epoch));
  if (epochs.size !== 1) {
    const err = new Error(`partial digests span multiple key epochs: ${[...epochs].join(",")}`);
    err.code = "EPOCH_MISMATCH";
    throw err;
  }
  let acc = 0n;
  for (const p of partials) {
    acc = (acc + hexToBigInt(p.digest || p.hash)) % MOD;
  }
  return digestToHex(acc);
}

module.exports = {
  MOD,
  canonicalRowBytes,
  hashMultiset,
  hashMultisetProjections,
  combinePartials,
  digestToHex,
  hexToBigInt,
};
