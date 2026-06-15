/** Client-side S3 console deep links for proof/checkpoint URIs */

export function s3ConsoleUrl(s3Uri, region = "us-east-1") {
  if (!s3Uri || !String(s3Uri).startsWith("s3://")) return null;
  const without = s3Uri.replace(/^s3:\/\//, "");
  const slash = without.indexOf("/");
  const bucket = slash >= 0 ? without.slice(0, slash) : without;
  const key = slash >= 0 ? without.slice(slash + 1) : "";
  const prefix = key ? `&prefix=${encodeURIComponent(key)}` : "";
  return `https://s3.console.aws.amazon.com/s3/buckets/${encodeURIComponent(bucket)}?region=${region}${prefix}&tab=objects`;
}
