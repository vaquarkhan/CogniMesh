"use strict";

const { parseS3Uri } = require("./s3-uri");

function s3Enabled() {
  return process.env.VRP_S3_PERSIST !== "false" && Boolean(process.env.PROOF_BUCKET || process.env.PROOF_BUCKET_NAME);
}

function proofBucket() {
  return process.env.PROOF_BUCKET || process.env.PROOF_BUCKET_NAME;
}

async function getS3Client() {
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
}

async function putJsonObject(key, payload, options = {}) {
  const bucket = options.bucket || proofBucket();
  if (!bucket) return { persisted: false, reason: "PROOF_BUCKET not set" };

  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const client = await getS3Client();
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  const cmd = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: options.contentType || "application/json",
  };
  if (process.env.VRP_OBJECT_LOCK_MODE && process.env.VRP_OBJECT_LOCK_RETAIN_DAYS) {
    const days = Number(process.env.VRP_OBJECT_LOCK_RETAIN_DAYS);
    const retain = new Date(Date.now() + days * 86400000);
    cmd.ObjectLockMode = process.env.VRP_OBJECT_LOCK_MODE;
    cmd.ObjectLockRetainUntilDate = retain;
  }
  await client.send(new PutObjectCommand(cmd));
  return { persisted: true, s3Uri: `s3://${bucket}/${key}`, bucket, key };
}

async function getJsonObject(key, options = {}) {
  const bucket = options.bucket || proofBucket();
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const client = await getS3Client();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await res.Body.transformToString();
  return JSON.parse(text);
}

async function putBinaryObject(s3Uri, bytes, options = {}) {
  const { bucket, key } = parseS3Uri(s3Uri);
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const client = await getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: options.contentType || "application/octet-stream",
    })
  );
  return { s3Uri, bucket, key };
}

async function getObjectBytes(s3Uri, options = {}) {
  const { bucket, key } = parseS3Uri(s3Uri);
  const { GetObjectCommand } = require("@aws-sdk/client-s3");
  const client = await getS3Client();
  const cmd = { Bucket: bucket, Key: key };
  if (options.range) cmd.Range = options.range;
  const res = await client.send(new GetObjectCommand(cmd));
  return Buffer.from(await res.Body.transformToByteArray());
}

module.exports = {
  s3Enabled,
  proofBucket,
  putJsonObject,
  getJsonObject,
  putBinaryObject,
  getObjectBytes,
};
