"use strict";

function parseCsv(value) {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Strip trailing slash for stable Origin comparison. */
function normalizeOrigin(origin) {
  if (!origin || typeof origin !== "string") return origin;
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return origin.replace(/\/$/, "");
  }
}

function loadCorsConfig() {
  const exact = parseCsv(
    process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173,http://localhost:4173"
  ).map(normalizeOrigin);
  const suffixes = parseCsv(process.env.CORS_ORIGIN_SUFFIXES);
  return { exact, suffixes };
}

function hostMatchesSuffix(hostname, suffix) {
  if (!hostname || !suffix) return false;
  const normalized = suffix.startsWith(".") ? suffix : `.${suffix}`;
  return hostname === normalized.slice(1) || hostname.endsWith(normalized);
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  const { exact, suffixes } = loadCorsConfig();
  if (exact.includes(normalized)) return true;
  try {
    const { hostname } = new URL(normalized);
    return suffixes.some((suffix) => hostMatchesSuffix(hostname, suffix));
  } catch {
    return false;
  }
}

function isAllowedReferer(referer) {
  if (!referer) return false;
  const { exact, suffixes } = loadCorsConfig();
  if (exact.some((o) => referer.startsWith(o))) return true;
  try {
    const { hostname } = new URL(referer);
    return suffixes.some((suffix) => hostMatchesSuffix(hostname, suffix));
  } catch {
    return false;
  }
}

module.exports = {
  parseCsv,
  normalizeOrigin,
  isAllowedOrigin,
  isAllowedReferer,
  loadCorsConfig,
};
