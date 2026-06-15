const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function previewPipeline({ nodes, edges, pipelineMeta, token }) {
  const res = await fetch(`${API_BASE}/api/v1/pipelines/preview`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  });
  return res.json();
}

export async function deployPipeline({ nodes, edges, pipelineMeta, token }) {
  const res = await fetch(`${API_BASE}/api/v1/pipelines/deploy`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function listProducts({ token, domain } = {}) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await fetch(`${API_BASE}/api/v1/products${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to load marketplace");
  return res.json();
}

export async function listLineageCatalog({ token, domain } = {}) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await fetch(`${API_BASE}/api/v1/lineage/catalog${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to load lineage catalog");
  return res.json();
}

export async function getProductLineage({ token, productId }) {
  const res = await fetch(`${API_BASE}/api/v1/products/${encodeURIComponent(productId)}/lineage`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Lineage not found");
  return res.json();
}

export async function getPipelineHistory({ token, name, domain }) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await fetch(`${API_BASE}/api/v1/pipelines/${encodeURIComponent(name)}/history${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to load pipeline history");
  return res.json();
}
