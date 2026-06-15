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
  });
  next();
}

module.exports = { structuredLog, requestLogger };
