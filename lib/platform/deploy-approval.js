"use strict";

const fs = require("fs");
const path = require("path");

const pending = [];
const approved = [];
const rejected = [];

const storePath = () =>
  process.env.DEPLOY_APPROVALS_PATH || path.join(process.cwd(), "data", "deploy-approvals.json");

function loadStore() {
  try {
    const file = storePath();
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(data.pending)) pending.push(...data.pending);
    if (Array.isArray(data.approved)) approved.push(...data.approved);
    if (Array.isArray(data.rejected)) rejected.push(...data.rejected);
  } catch {
    // non-fatal
  }
}

function persistStore() {
  if (process.env.DEPLOY_APPROVALS_PERSIST === "false") return;
  try {
    const file = storePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ pending, approved: approved.slice(-50), rejected: rejected.slice(-50) }, null, 2),
      "utf8"
    );
  } catch {
    // non-fatal
  }
}

loadStore();

function isDeployApprovalRequired() {
  return process.env.DEPLOY_APPROVAL_REQUIRED === "true";
}

function queueDeployApproval({ nodes, edges, pipelineMeta, userId, userEmail }) {
  const record = {
    id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pipelineName: pipelineMeta?.name || "unknown",
    domain: pipelineMeta?.domain || "unknown",
    version: pipelineMeta?.version || "?",
    status: "pending",
    requestedAt: new Date().toISOString(),
    userId: userId || "anonymous",
    userEmail: userEmail || "",
    nodes,
    edges: edges || [],
    pipelineMeta,
  };
  pending.push(record);
  persistStore();
  return record;
}

function listPendingDeployApprovals() {
  return [...pending];
}

function getDeployApproval(id) {
  return pending.find((r) => r.id === id) || approved.find((r) => r.id === id) || null;
}

function approveDeploy(id, stewardId) {
  const idx = pending.findIndex((r) => r.id === id);
  if (idx < 0) return { success: false, error: "Deploy approval not found" };
  const record = {
    ...pending[idx],
    status: "approved",
    approvedAt: new Date().toISOString(),
    stewardId: stewardId || "steward",
  };
  pending.splice(idx, 1);
  approved.push(record);
  persistStore();
  return { success: true, record };
}

function rejectDeploy(id, stewardId, reason) {
  const idx = pending.findIndex((r) => r.id === id);
  if (idx < 0) return { success: false, error: "Deploy approval not found" };
  const record = {
    ...pending[idx],
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    stewardId: stewardId || "steward",
    rejectReason: reason || "Denied by steward",
  };
  pending.splice(idx, 1);
  rejected.push(record);
  persistStore();
  return { success: true, record };
}

module.exports = {
  isDeployApprovalRequired,
  queueDeployApproval,
  listPendingDeployApprovals,
  getDeployApproval,
  approveDeploy,
  rejectDeploy,
};
