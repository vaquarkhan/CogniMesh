"use strict";

const { CognitoJwtVerifier } = require("aws-jwt-verify");

let verifier = null;

function getVerifier() {
  if (process.env.AUTH_DISABLED === "true") return null;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) return null;

  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: "id",
      clientId,
    });
  }
  return verifier;
}

async function requireAuth(req, res, next) {
  if (process.env.AUTH_DISABLED === "true") {
    req.auth = { userEmail: "local-dev@cognimesh.local", sub: "local-dev" };
    return next();
  }

  const v = getVerifier();
  if (!v) {
    return res.status(503).json({
      status: "error",
      errors: ["Authentication not configured. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID."],
    });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ status: "error", errors: ["Missing Authorization Bearer token"] });
  }

  try {
    const payload = await v.verify(token);
    req.auth = {
      sub: payload.sub,
      userEmail: payload.email || payload["cognito:username"],
      bearerToken: token,
      groups: payload["cognito:groups"] || [],
    };
    next();
  } catch (err) {
    return res.status(401).json({ status: "error", errors: ["Invalid or expired token"] });
  }
}

module.exports = { requireAuth };
