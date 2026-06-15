const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...authHeaders(options.token),
      ...options.headers,
    },
  });
  return res;
}

export async function previewPipeline({ nodes, edges, pipelineMeta, token }) {
  const res = await apiFetch("/api/v1/pipelines/preview", {
    method: "POST",
    token,
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  });
  return res.json();
}

export async function deployPipeline({ nodes, edges, pipelineMeta, token }) {
  const res = await apiFetch("/api/v1/pipelines/deploy", {
    method: "POST",
    token,
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function listProducts({ token, domain } = {}) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await apiFetch(`/api/v1/products${qs}`, { token });
  if (!res.ok) throw new Error("Failed to load marketplace");
  return res.json();
}

export async function listLineageCatalog({ token, domain } = {}) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await apiFetch(`/api/v1/lineage/catalog${qs}`, { token });
  if (!res.ok) throw new Error("Failed to load lineage catalog");
  return res.json();
}

export async function getProductLineage({ token, productId }) {
  const res = await apiFetch(`/api/v1/products/${encodeURIComponent(productId)}/lineage`, { token });
  if (!res.ok) throw new Error("Lineage not found");
  return res.json();
}

export async function getPipelineHistory({ token, name, domain }) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await apiFetch(`/api/v1/pipelines/${encodeURIComponent(name)}/history${qs}`, { token });
  if (!res.ok) throw new Error("Failed to load pipeline history");
  return res.json();
}

export async function requestProductAccess({ token, productId, reason }) {
  const res = await apiFetch(`/api/v1/products/${encodeURIComponent(productId)}/access-requests`, {
    method: "POST",
    token,
    body: JSON.stringify({ reason: reason || "Consumer access request from portal" }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function triggerBackfill({ token, pipelineName, domain, startDate, endDate }) {
  const res = await apiFetch(`/api/v1/pipelines/${encodeURIComponent(pipelineName)}/backfill`, {
    method: "POST",
    token,
    body: JSON.stringify({ domain, startDate, endDate }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}
