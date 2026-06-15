"use strict";

const pending = [];

function requestAccess({ productId, userId, userEmail, reason }) {
  const record = {
    id: `ar-${Date.now()}`,
    productId,
    userId: userId || "anonymous",
    userEmail: userEmail || "",
    reason: reason || "",
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  pending.push(record);
  return record;
}

function listPending() {
  return [...pending];
}

module.exports = { requestAccess, listPending };
