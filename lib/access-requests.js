"use strict";

const pending = [];
const approved = [];
const rejected = [];

function requestAccess({ productId, userId, userEmail, reason, productName, domain }) {
  const record = {
    id: `ar-${Date.now()}`,
    productId,
    productName: productName || productId,
    domain: domain || "",
    userId: userId || "anonymous",
    userEmail: userEmail || "",
    reason: reason || "Consumer access request from marketplace",
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  pending.push(record);
  return record;
}

function listPending() {
  return [...pending];
}

function listAll() {
  return [...pending, ...approved, ...rejected];
}

function listForUser(userId) {
  if (!userId) return [];
  return listAll().filter((r) => r.userId === userId);
}

function getAccessForProduct(productId, userId) {
  const all = listAll().filter((r) => r.productId === productId);
  if (userId) {
    const mine = all.filter((r) => r.userId === userId);
    if (mine.length) return mine.sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""))[0];
  }
  return all.sort((a, b) => (b.requestedAt || "").localeCompare(a.requestedAt || ""))[0] || null;
}

function approveRequest(id, stewardId) {
  const idx = pending.findIndex((r) => r.id === id);
  if (idx < 0) return { success: false, error: "Request not found" };
  const record = {
    ...pending[idx],
    status: "approved",
    approvedAt: new Date().toISOString(),
    stewardId: stewardId || "steward",
    lakeFormationGrant: {
      granted: false,
      permission: "SELECT",
      implemented: true,
      simulated: true,
      note:
        "Access approved in CogniMesh. Lake Formation grant pending (see approve response after grantConsumerSelect).",
    },
  };
  pending.splice(idx, 1);
  approved.push(record);
  return { success: true, record };
}

function setLakeFormationGrant(requestId, grant) {
  const record = approved.find((r) => r.id === requestId);
  if (!record) return null;
  record.lakeFormationGrant = grant;
  return record;
}

function rejectRequest(id, stewardId, reason) {
  const idx = pending.findIndex((r) => r.id === id);
  if (idx < 0) return { success: false, error: "Request not found" };
  const record = {
    ...pending[idx],
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    stewardId: stewardId || "steward",
    rejectReason: reason || "Denied by steward",
  };
  pending.splice(idx, 1);
  rejected.push(record);
  return { success: true, record };
}

module.exports = {
  requestAccess,
  listPending,
  listAll,
  listForUser,
  getAccessForProduct,
  approveRequest,
  rejectRequest,
  setLakeFormationGrant,
};
