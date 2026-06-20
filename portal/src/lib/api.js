import { fetchAuthSession } from "aws-amplify/auth";

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function resolveToken(passedToken) {
  if (passedToken === "local-dev") return passedToken;
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) return idToken;
  } catch { /* no active session — fall back to passed token */ }
  return passedToken;
}

export async function apiFetch(path, options = {}) {
  const { token, headers: extraHeaders, ...fetchOptions } = options;
  const freshToken = await resolveToken(token);
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...fetchOptions,
    headers: {
      ...authHeaders(freshToken),
      ...extraHeaders,
    },
  });
  return res;
}

/** When the API returns HTML instead of JSON, explain likely causes (CloudFront SPA fallback, CORS, etc.). */
function apiJsonErrorMessage(res, context) {
  if (res.status === 403) {
    return `${context}: request blocked (403). If using CloudFront, ensure CORS_ORIGIN_SUFFIXES includes .cloudfront.net or add the portal URL to portal_callback_urls and re-apply Terraform.`;
  }
  if (res.ok) {
    return `${context}: received HTML instead of JSON — check CloudFront routes /api/* to the API origin (not the SPA bucket).`;
  }
  return `${context}: API unavailable (HTTP ${res.status}). Run npm run dev:api locally or check the ECS/ALB service.`;
}

export async function parseJsonResponse(res, context = "API") {
  const text = await res.text();
  if (!text || !text.trim()) {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    console.warn(`${context}: received HTML instead of JSON (${res.status})`);
    return { status: "error", errors: [apiJsonErrorMessage(res, context)] };
  }
  try {
    return JSON.parse(text);
  } catch {
    console.warn(`${context}: invalid JSON (${res.status})`, trimmed.slice(0, 80));
    return { status: "error", errors: [apiJsonErrorMessage(res, context)] };
  }
}

async function safeJson(res, context) {
  return parseJsonResponse(res, context);
}

export async function previewPipeline({ nodes, edges, pipelineMeta, token }) {
  const res = await apiFetch("/api/v1/pipelines/preview", {
    method: "POST",
    token,
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  });
  const data = await safeJson(res, "Preview");
  if (!data) {
    return { status: "error", errors: ["API unavailable - run npm run start:dev (port 4000) for preview."] };
  }
  if (data.status === "error" && data.errors) return data;
  return data;
}

export async function deployPipeline({ nodes, edges, pipelineMeta, token }) {
  const res = await apiFetch("/api/v1/pipelines/deploy", {
    method: "POST",
    token,
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  });
  const data = await safeJson(res, "Deploy");
  if (!data) {
    return { ok: false, data: { errors: ["API unavailable - run npm run start:dev for deploy."] } };
  }
  if (data.status === "error" && data.errors) {
    return { ok: false, data };
  }
  if (res.status === 202 && data.status === "pending_approval") {
    return { ok: true, pendingApproval: true, data };
  }
  return { ok: res.ok, data };
}

export async function listProducts({ token, domain } = {}) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await apiFetch(`/api/v1/products${qs}`, { token });
  if (!res.ok) throw new Error("Failed to load marketplace");
  const data = await safeJson(res, "Products");
  if (!data) throw new Error("Marketplace API unavailable");
  return data;
}

export async function listLineageCatalog({ token, domain } = {}) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await apiFetch(`/api/v1/lineage/catalog${qs}`, { token });
  if (!res.ok) throw new Error("Failed to load lineage catalog");
  const data = await safeJson(res, "Lineage");
  if (!data) throw new Error("Lineage API unavailable");
  return data;
}

export async function getProductLineage({ token, productId }) {
  const res = await apiFetch(`/api/v1/products/${encodeURIComponent(productId)}/lineage`, { token });
  if (!res.ok) throw new Error("Lineage not found");
  const data = await safeJson(res, "Product lineage");
  if (!data) throw new Error("Lineage API unavailable");
  return data;
}

export async function getPipelineHistory({ token, name, domain }) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await apiFetch(`/api/v1/pipelines/${encodeURIComponent(name)}/history${qs}`, { token });
  if (!res.ok) throw new Error("Failed to load pipeline history");
  const data = await safeJson(res, "History");
  if (!data) throw new Error("History API unavailable");
  return data;
}

export async function getPipelineObservability({ token, name, domain }) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const res = await apiFetch(`/api/v1/pipelines/${encodeURIComponent(name)}/observability${qs}`, { token });
  if (!res.ok) throw new Error("Failed to load observability");
  const data = await safeJson(res, "Observability");
  if (!data) throw new Error("Observability API unavailable");
  return data;
}

export async function requestProductAccess({ token, productId, reason, productName, domain }) {
  const res = await apiFetch(`/api/v1/products/${encodeURIComponent(productId)}/access-requests`, {
    method: "POST",
    token,
    body: JSON.stringify({
      reason: reason || "Consumer access request from portal",
      productName,
      domain,
    }),
  });
  const data = await safeJson(res, "Access request");
  return { ok: res.ok, data: data || { errors: ["API unavailable"] } };
}

export async function triggerBackfill({ token, pipelineName, domain, startDate, endDate }) {
  const res = await apiFetch(`/api/v1/pipelines/${encodeURIComponent(pipelineName)}/backfill`, {
    method: "POST",
    token,
    body: JSON.stringify({ domain, startDate, endDate }),
  });
  const data = await safeJson(res, "Backfill");
  return { ok: res.ok, data: data || { errors: ["API unavailable"] } };
}

export async function designPipelineFromAi({ message, token }) {
  const res = await apiFetch("/api/v1/pipelines/ai-design", {
    method: "POST",
    token,
    body: JSON.stringify({ message }),
  });
  const data = await safeJson(res, "AI design");
  if (!data) {
    return {
      success: false,
      errors: ["API unavailable - AI matching runs locally in the sidebar (no gateway required)."],
    };
  }
  return data;
}

export async function runAwsDesignReview({ nodes, edges, pipelineMeta, token }) {
  const res = await apiFetch("/api/v1/pipelines/design-review", {
    method: "POST",
    token,
    body: JSON.stringify({ nodes, edges, pipelineMeta }),
  });
  const data = await parseJsonResponse(res, "Design review");
  if (!data) {
    return {
      status: "error",
      errors: ["API unavailable — start the gateway with npm run dev:api"],
      fixHint: "Run npm run dev:minimal from the repo root, then click Re-scan.",
    };
  }
  if (!res.ok) {
    return {
      status: "error",
      errors: data.errors || [`Design review failed (${res.status})`],
      fixHint: data.fixHint || "Fix canvas validation errors and try again.",
      graphErrors: data.graphErrors,
    };
  }
  return data;
}

export async function getDesignReviewFixHelp({
  token,
  nodes,
  edges,
  pipelineMeta,
  findingId,
  findingIds,
}) {
  const res = await apiFetch("/api/v1/pipelines/design-review/fix-help", {
    method: "POST",
    token,
    body: JSON.stringify({ nodes, edges, pipelineMeta, findingId, findingIds }),
  });
  const data = await parseJsonResponse(res, "Fix help");
  if (!res.ok || !data || data.status === "error") {
    throw new Error(data?.errors?.[0] || "Fix help unavailable");
  }
  return data;
}

export async function getExecutionStatus({ token, executionArn }) {
  const qs = `?arn=${encodeURIComponent(executionArn)}`;
  const res = await apiFetch(`/api/v1/executions/status${qs}`, { token });
  return safeJson(res, "Execution status");
}

export async function getProductConsumerDetail({ token, productId }) {
  const res = await apiFetch(`/api/v1/products/${encodeURIComponent(productId)}/consumer-detail`, { token });
  if (!res.ok) throw new Error("Product detail unavailable");
  const data = await safeJson(res, "Consumer detail");
  if (!data) throw new Error("Product API unavailable");
  return data;
}

export async function listPendingAccessRequests({ token }) {
  const res = await apiFetch("/api/v1/access-requests/pending", { token });
  if (!res.ok) throw new Error("Failed to load access requests");
  const data = await safeJson(res, "Access requests");
  if (!data) throw new Error("Access requests API unavailable");
  return data;
}

export async function approveAccessRequest({ token, requestId }) {
  const res = await apiFetch(`/api/v1/access-requests/${encodeURIComponent(requestId)}/approve`, {
    method: "POST",
    token,
  });
  const data = await safeJson(res, "Approve");
  return { ok: res.ok, data: data || {} };
}

export async function rejectAccessRequest({ token, requestId, reason }) {
  const res = await apiFetch(`/api/v1/access-requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    token,
    body: JSON.stringify({ reason }),
  });
  const data = await safeJson(res, "Reject");
  return { ok: res.ok, data: data || {} };
}

export async function getApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      const deep = await res.json();
      if (deep && deep.status !== "error" && deep.checks) return deep;
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/config`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status !== "error") {
        return { status: "ok", auth: data.authDisabled ? "disabled" : "cognito", region: data.region || null };
      }
    }
  } catch { /* no health available */ }
  return null;
}

export async function isApiReachable() {
  try {
    const data = await getApiHealth();
    if (!data) return false;
    return data.status === "ok" || data.status === "degraded";
  } catch {
    return false;
  }
}
