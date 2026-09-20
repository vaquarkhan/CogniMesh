"use strict";

/**
 * Short-lived marketplace subscription tokens for agents/MCP.
 * HMAC format mirrors gateway-token; claims bind product + snapshot pin + VRP PASS.
 */

const crypto = require("crypto");
const { signGatewayStamp, verifyGatewayToken } = require("./gateway-token");
const { buildSnapshotPinSql } = require("./snapshot-pin");

function subscriptionTtlSec() {
  return Number(process.env.MARKETPLACE_SUBSCRIPTION_TTL_SEC || process.env.VRP_GATEWAY_TOKEN_TTL_SEC || 3600);
}

function mintSubscriptionToken(claims = {}) {
  const now = new Date();
  const ttlSec = subscriptionTtlSec();
  const expMs = now.getTime() + ttlSec * 1000;
  const stamp = {
    kind: "subscription",
    product_id: claims.product_id,
    consumer_sub: claims.consumer_sub || null,
    proof_id: claims.proof_id || null,
    iceberg_snapshot_id: claims.iceberg_snapshot_id || null,
    schema_fingerprint: claims.schema_fingerprint || null,
    vrp_verdict: "PASS",
    snapshot_pin_sql: claims.snapshot_pin_sql || null,
    session_id: claims.session_id || `sub-${crypto.randomBytes(8).toString("hex")}`,
    served_at: now.toISOString(),
    exp: new Date(expMs).toISOString(),
  };
  return {
    token: signGatewayStamp(stamp),
    claims: stamp,
    expiresAt: stamp.exp,
    ttlSec,
  };
}

function verifySubscriptionToken(token, options = {}) {
  const result = verifyGatewayToken(token, {
    sessionId: options.sessionId,
    proofId: options.proofId,
  });
  if (!result.valid) return result;
  const stamp = result.stamp;
  if (stamp.kind && stamp.kind !== "subscription") {
    return { valid: false, reason: "not a subscription token" };
  }
  if (stamp.vrp_verdict !== "PASS") {
    return { valid: false, reason: "subscription token requires VRP PASS" };
  }
  if (options.productId && stamp.product_id !== options.productId) {
    return { valid: false, reason: "subscription token product mismatch" };
  }
  if (stamp.exp) {
    const expMs = new Date(stamp.exp).getTime();
    if (!Number.isNaN(expMs) && Date.now() > expMs) {
      return { valid: false, reason: "subscription token expired" };
    }
  }
  return { valid: true, stamp };
}

function buildSubscriptionPin(product, trust) {
  const tags = product?.tags || {};
  const database =
    tags.catalogDatabase ||
    product?.catalogDatabase ||
    product?.domain ||
    "default";
  const table = tags.catalogTable || product?.catalogTable || product?.name || "output";
  const snapshotId = trust?.icebergSnapshotId || tags.icebergSnapshotId || null;
  return buildSnapshotPinSql({ database, table }, snapshotId);
}

module.exports = {
  mintSubscriptionToken,
  verifySubscriptionToken,
  buildSubscriptionPin,
  subscriptionTtlSec,
};
