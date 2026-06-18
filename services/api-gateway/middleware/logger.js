"use strict";

function structuredLog(event, fields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    service: "cognimesh-api-gateway",
    event,
    ...fields,
  });
  if (fields.level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    structuredLog("http_request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      user_id: req.auth?.sub,
    });
    if (res.statusCode >= 500) {
      try {
        const { incEmf } = require("../../../lib/metrics-emf");
        incEmf("http_5xx", 1, { path: req.path.replace(/\/[a-f0-9-]{20,}/gi, "/:id") });
      } catch {
        /* non-fatal */
      }
    }
  });
  next();
}

module.exports = { structuredLog, requestLogger };
