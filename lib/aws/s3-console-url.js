"use strict";

/** s3://bucket/key → AWS Console object URL */

function s3ConsoleUrl(s3Uri, region) {
  if (!s3Uri || !String(s3Uri).startsWith("s3://")) return null;
  const without = s3Uri.replace(/^s3:\/\//, "");
  const slash = without.indexOf("/");
  const bucket = slash >= 0 ? without.slice(0, slash) : without;
  const key = slash >= 0 ? without.slice(slash + 1) : "";
  const r = region || process.env.AWS_REGION || "us-east-1";
  const prefix = key ? `&prefix=${encodeURIComponent(key)}` : "";
  return `https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(bucket)}?region=${r}${prefix}&tab=objects`;
}

module.exports = { s3ConsoleUrl };
