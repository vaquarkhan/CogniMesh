"use strict";

/** Convert monetary values to integer minor units (cents) for exact invariant checks. */
function toMinorUnits(value, scale = 100) {
  if (value == null || value === "") return 0n;
  const s = String(value).trim();
  if (!s) return 0n;
  const negative = s.startsWith("-");
  const abs = negative ? s.slice(1) : s;
  const [whole = "0", frac = ""] = abs.split(".");
  const fracPadded = (frac + "00").slice(0, String(scale).length > 1 ? 2 : 0);
  const minor = BigInt(whole) * BigInt(scale) + BigInt(fracPadded.padEnd(2, "0").slice(0, 2) || "0");
  return negative ? -minor : minor;
}

function sumMinor(rows, field, moneyFields = []) {
  const asMoney = moneyFields.includes(field);
  let total = 0n;
  for (const row of rows) {
    const v = row[field];
    if (asMoney) total += toMinorUnits(v);
    else total += BigInt(Math.trunc(Number(v) || 0));
  }
  return total;
}

/** Exact rational multiply for invariant checks (e.g. feeMultiplier "0.98"). */
function scaleMinor(value, multiplier) {
  const m = String(multiplier ?? "1").trim();
  const negative = m.startsWith("-");
  const abs = negative ? m.slice(1) : m;
  const [whole = "0", frac = ""] = abs.split(".");
  const scale = 10n ** BigInt(frac.length || 0);
  const num = BigInt(`${whole}${frac}` || "0");
  const product = value * num;
  const rounded = product >= 0n ? (product + scale / 2n) / scale : (product - scale / 2n) / scale;
  return negative ? -rounded : rounded;
}

module.exports = { toMinorUnits, sumMinor, scaleMinor };
