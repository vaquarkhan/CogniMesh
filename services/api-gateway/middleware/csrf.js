"use strict";

const { isAllowedOrigin, isAllowedReferer } = require("../lib/cors-origins");

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF mitigation for browser clients: require Origin or Referer to match allowlist
 * on mutating requests. API clients with Bearer tokens from non-browser contexts
 * may set X-CogniMesh-Client: api to skip (machine-to-machine).
 */
function csrfProtection(req, res, next) {
  if (!MUTATING.has(req.method)) return next();
  if (req.headers["x-cognimesh-client"] === "api") return next();
  if (process.env.CSRF_DISABLED === "true") return next();

  // Requests authenticated with an explicit Bearer token are not CSRF-vulnerable: CSRF relies
  // on the browser auto-attaching ambient credentials (cookies), but a Bearer token must be set
  // explicitly by the app's JS. Some browsers (e.g. Firefox) omit Origin on same-origin POSTs.
  const authz = req.headers.authorization || "";
  if (authz.startsWith("Bearer ")) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin && isAllowedOrigin(origin)) return next();

  if (referer && isAllowedReferer(referer)) return next();

  // Local dev: no Origin on some tools
  if (process.env.AUTH_DISABLED === "true" && !origin && !referer) {
    return next();
  }

  return res.status(403).json({
    status: "error",
    errors: ["CSRF check failed: invalid or missing Origin"],
  });
}

module.exports = { csrfProtection };
