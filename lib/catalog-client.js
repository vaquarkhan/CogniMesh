"use strict";

/**
 * Catalog client with optional embedded in-memory fallback for local dev
 * (no Java/Maven required when Spring catalog is offline).
 */

const catalogUrl = () => process.env.CATALOG_URL || "http://localhost:8080";

function catalogStorageMode() {
  const raw = (
    process.env.CATALOG_STORAGE ||
    process.env.CATALOG_FALLBACK ||
    "embedded"
  ).toLowerCase();
  if (raw === "memory" || raw === "embedded" || raw === "true") return "embedded";
  if (raw === "none" || raw === "remote") return "remote";
  return "embedded";
}

function fallbackEnabled() {
  return catalogStorageMode() === "embedded";
}

const embedded = new Map();

function toResponse(record) {
  return {
    id: record.id,
    name: record.name,
    domain: record.domain,
    version: record.version,
    status: record.status,
    registeredAt: record.registeredAt,
    tags: record.tags || {},
  };
}

function registerEmbedded(payload) {
  const id = `${payload.domain}-${payload.name}-${payload.version}`;
  const record = {
    id,
    name: payload.name,
    domain: payload.domain,
    version: payload.version,
    status: payload.integrityGatePassed ? "approved" : "pending_integrity_gate",
    registeredAt: new Date().toISOString(),
    tags: payload.tags || {},
    manifestYaml: payload.manifestYaml,
    description: payload.description,
  };
  embedded.set(id, record);
  return toResponse(record);
}

function listEmbedded(domain) {
  let items = [...embedded.values()];
  if (domain) {
    items = items.filter((p) => p.domain === domain);
  }
  return items.map(toResponse);
}

function getEmbedded(id) {
  const record = embedded.get(id);
  if (!record) {
    const err = new Error(`Product not found: ${id}`);
    err.status = 404;
    throw err;
  }
  return toResponse(record);
}

async function catalogReachable() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${catalogUrl()}/api/v1/products`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

async function registerProduct(payload, auth = {}) {
  try {
    const res = await fetch(`${catalogUrl()}/api/v1/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth.bearerToken ? { Authorization: `Bearer ${auth.bearerToken}` } : {}),
        ...(auth.userEmail ? { "X-CogniMesh-User": auth.userEmail } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { source: "remote", product: await res.json() };
    }
    const text = await res.text();
    if (fallbackEnabled()) {
      return { source: "embedded", product: registerEmbedded(payload), remoteError: text };
    }
    return { source: "error", error: text };
  } catch (err) {
    if (fallbackEnabled()) {
      return { source: "embedded", product: registerEmbedded(payload), remoteError: err.message };
    }
    return { source: "error", error: err.message };
  }
}

async function listProducts(domain, auth = {}) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  try {
    const res = await fetch(`${catalogUrl()}/api/v1/products${qs}`, {
      headers: {
        ...(auth.bearerToken ? { Authorization: `Bearer ${auth.bearerToken}` } : {}),
        ...(auth.userEmail ? { "X-CogniMesh-User": auth.userEmail } : {}),
      },
    });
    if (res.ok) {
      return { source: "remote", products: await res.json() };
    }
    if (fallbackEnabled()) {
      return { source: "embedded", products: listEmbedded(domain) };
    }
    return { source: "error", error: await res.text() };
  } catch (err) {
    if (fallbackEnabled()) {
      return { source: "embedded", products: listEmbedded(domain) };
    }
    return { source: "error", error: err.message };
  }
}

async function getProduct(id, auth = {}) {
  try {
    const res = await fetch(`${catalogUrl()}/api/v1/products/${encodeURIComponent(id)}`, {
      headers: {
        ...(auth.bearerToken ? { Authorization: `Bearer ${auth.bearerToken}` } : {}),
        ...(auth.userEmail ? { "X-CogniMesh-User": auth.userEmail } : {}),
      },
    });
    if (res.ok) {
      return { source: "remote", product: await res.json() };
    }
    if (fallbackEnabled()) {
      return { source: "embedded", product: getEmbedded(id) };
    }
    return { source: "error", error: await res.text() };
  } catch (err) {
    if (fallbackEnabled()) {
      try {
        return { source: "embedded", product: getEmbedded(id) };
      } catch (e) {
        return { source: "error", error: e.message };
      }
    }
    return { source: "error", error: err.message };
  }
}

function embeddedStats() {
  return { count: embedded.size, ids: [...embedded.keys()] };
}

module.exports = {
  catalogReachable,
  registerProduct,
  listProducts,
  getProduct,
  embeddedStats,
  fallbackEnabled,
  catalogStorageMode,
};
