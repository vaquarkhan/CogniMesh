import { apiFetch, parseJsonResponse } from "./api";

async function platformGet(path, token) {
  const res = await apiFetch(path, { token });
  return parseJsonResponse(res, "Platform");
}

async function platformPost(path, body, token) {
  const res = await apiFetch(path, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
  return parseJsonResponse(res, "Platform");
}

export async function getLiveDashboard(token) {
  return platformGet("/api/v1/platform/dashboard", token);
}

export async function listPipelineVersions(token, domain, name) {
  return platformGet(
    `/api/v1/platform/versions/${encodeURIComponent(domain)}/${encodeURIComponent(name)}`,
    token
  );
}

export async function rollbackPipelineVersion(token, versionId) {
  return platformGet(`/api/v1/platform/versions/rollback/${encodeURIComponent(versionId)}`, token);
}

export async function previewSourceData(token, { nodes, edges, pipelineMeta, limit }) {
  return platformPost("/api/v1/platform/preview-source", { nodes, edges, pipelineMeta, limit }, token);
}

export async function deployAgentManifest(token, manifest) {
  return platformPost("/api/v1/agents/deploy", { manifest }, token);
}

export async function getHealthScores(token, domain) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  return platformGet(`/api/v1/platform/health${qs}`, token);
}

export async function analyzeImpact(token, { nodes, edges, pipelineMeta, changedColumns }) {
  return platformPost("/api/v1/platform/impact", { nodes, edges, pipelineMeta, changedColumns }, token);
}

export async function getCostDashboard(token, domain) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  return platformGet(`/api/v1/platform/costs${qs}`, token);
}

export async function getAuditReport(token, domain) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}&format=json` : "?format=json";
  return platformGet(`/api/v1/platform/audit-report${qs}`, token);
}

export async function getColumnLineage(token, { nodes, edges, pipelineMeta }) {
  return platformPost("/api/v1/platform/column-lineage", { nodes, edges, pipelineMeta }, token);
}

export async function getDeployTargets(token) {
  return platformGet("/api/v1/platform/deploy-targets", token);
}

export async function getFederatedProducts(token) {
  return platformGet("/api/v1/platform/federated-products", token);
}

export async function listPlugins(token) {
  return platformGet("/api/v1/platform/plugins", token);
}

export async function askCopilot(token, { message, pipelineName, domain }) {
  return platformPost("/api/v1/platform/copilot", { message, pipelineName, domain }, token);
}

export async function getNotificationConfig(token) {
  return platformGet("/api/v1/platform/notifications/config", token);
}

export async function getOpenSpec(token) {
  return platformGet("/api/v1/platform/open-spec", token);
}

export async function listSlaSubscriptions(token, productId) {
  const qs = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  return platformGet(`/api/v1/platform/sla${qs}`, token);
}
