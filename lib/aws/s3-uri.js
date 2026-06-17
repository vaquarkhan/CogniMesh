"use strict";

function parseS3Uri(uri) {
  if (!uri || !uri.startsWith("s3://")) {
    throw new Error(`Invalid S3 URI: ${uri}`);
  }
  const rest = uri.slice(5);
  const slash = rest.indexOf("/");
  if (slash === -1) return { bucket: rest, key: "" };
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

module.exports = { parseS3Uri };
