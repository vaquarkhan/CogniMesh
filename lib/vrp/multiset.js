"use strict";

const { sha256Canonical } = require("./canonical");

function hashMultiset(rows, fields) {
  const counts = {};
  for (const row of rows) {
    const key = fields.map((f) => String(row[f] ?? "")).join("|");
    counts[key] = String(Number(counts[key] || 0) + 1);
  }
  const sorted = {};
  for (const k of Object.keys(counts).sort()) sorted[k] = counts[k];
  return sha256Canonical(sorted);
}

module.exports = { hashMultiset };
