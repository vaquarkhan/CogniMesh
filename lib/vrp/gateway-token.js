"use strict";

const crypto = require("crypto");

function gatewaySecret() {
  return process.env.VRP_GATEWAY_SECRET || process.env.VRP_KMS_KEY_ID || "dev-gateway-secret-change-me";
}

function signGatewayStamp(stamp) {
  const payload = JSON.stringify(stamp);
  const sig = crypto.createHmac("sha256", gatewaySecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

function verifyGatewayToken(token, options = {}) {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "missing gateway token" };
  }
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return { valid: false, reason: "malformed gateway token" };
  const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", gatewaySecret()).update(payload).digest("base64url");
  if (sig !== expected) return { valid: false, reason: "gateway token signature mismatch" };
  const stamp = JSON.parse(payload);
  if (options.sessionId && stamp.session_id !== options.sessionId) {
    return { valid: false, reason: "gateway token session mismatch" };
  }
  if (options.proofId && stamp.proof_id !== options.proofId) {
    return { valid: false, reason: "gateway token proof mismatch" };
  }
  const now = Date.now();
  const servedAt = new Date(stamp.served_at).getTime();
  const ttlMs = Number(process.env.VRP_GATEWAY_TOKEN_TTL_SEC || 3600) * 1000;
  if (Number.isNaN(servedAt) || now - servedAt > ttlMs) {
    return { valid: false, reason: "gateway token expired" };
  }
  return { valid: true, stamp };
}

module.exports = { signGatewayStamp, verifyGatewayToken };
