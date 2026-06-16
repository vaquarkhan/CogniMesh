"use strict";

const { readStore, writeStore } = require("./platform-store");

const STORE_KEY = "deploy-approvals";
const pending = [];
const approved = [];
const rejected = [];

function reloadDeployApprovals() {
  pending.length = 0;
  approved.length = 0;
  rejected.length = 0;
  const data = readStore(STORE_KEY, { pending: [], approved: [], rejected: [] });
  if (Array.isArray(data.pending)) pending.push(...data.pending);
  if (Array.isArray(data.approved)) approved.push(...data.approved);
  if (Array.isArray(data.rejected)) rejected.push(...data.rejected);
}

function persistStore() {
  if (process.env.DEPLOY_APPROVALS_PERSIST === "false") return;
  writeStore(STORE_KEY, {
    pending,
    approved: approved.slice(-50),
    rejected: rejected.slice(-50),
  });
}

reloadDeployApprovals();

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
  reloadDeployApprovals,
};
