"use strict";

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const MAX = Number(process.env.RATE_LIMIT_MAX || 120);

const buckets = new Map();

function rateLimit(req, res, next) {
  const key = req.auth?.sub || req.ip || "anonymous";
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.start > WINDOW_MS) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  res.setHeader("X-RateLimit-Limit", String(MAX));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, MAX - bucket.count)));

  if (bucket.count > MAX) {
    return res.status(429).json({
      status: "error",
      errors: ["Rate limit exceeded. Try again later."],
    });
  }

  next();
}

module.exports = { rateLimit };
