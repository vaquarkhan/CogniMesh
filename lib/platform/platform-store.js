"use strict";

/**
 * Platform state store — file (default) or DynamoDB when PLATFORM_STORE=dynamodb.
 * DynamoDB uses in-memory cache with write-through (loaded at initPlatformStore).
 */

const fs = require("fs");
const path = require("path");

const memory = new Map();
let dynamoReady = false;
let docClient = null;

function tableName() {
  return process.env.PLATFORM_DYNAMODB_TABLE || process.env.PLATFORM_STORE_TABLE;
}

function filePath(storeKey) {
  const base = process.env.PLATFORM_DATA_DIR || path.join(process.cwd(), "data");
  return path.join(base, `${storeKey}.json`);
}

function useDynamo() {
  return process.env.PLATFORM_STORE === "dynamodb" && Boolean(tableName());
}

function getClient() {
  if (!docClient) {
    const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
    const region = process.env.AWS_REGION || "us-east-1";
    docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return docClient;
}

async function loadFromDynamo(storeKey) {
  const { GetCommand } = require("@aws-sdk/lib-dynamodb");
  const res = await getClient().send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: "platform-store", sk: storeKey },
    })
  );
  if (!res.Item?.body) return null;
  return JSON.parse(res.Item.body);
}

async function saveToDynamo(storeKey, data) {
  const { PutCommand } = require("@aws-sdk/lib-dynamodb");
  await getClient().send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: "platform-store",
        sk: storeKey,
        body: JSON.stringify(data),
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

function loadFromFile(storeKey) {
  try {
    const fp = filePath(storeKey);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function saveToFile(storeKey, data) {
  if (process.env.PLATFORM_STORE_PERSIST === "false") return;
  try {
    const fp = filePath(storeKey);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // non-fatal
  }
}

function readStore(storeKey, fallback = null) {
  if (memory.has(storeKey)) return memory.get(storeKey);
  const fileData = loadFromFile(storeKey);
  if (fileData != null) {
    memory.set(storeKey, fileData);
    return fileData;
  }
  return fallback;
}

function writeStore(storeKey, data) {
  memory.set(storeKey, data);
  if (useDynamo() && dynamoReady) {
    saveToDynamo(storeKey, data).catch(() => saveToFile(storeKey, data));
  } else {
    saveToFile(storeKey, data);
  }
}

async function initPlatformStore(storeKeys = []) {
  if (!useDynamo()) {
    dynamoReady = true;
    return { mode: "file", stores: storeKeys };
  }
  for (const key of storeKeys) {
    const data = await loadFromDynamo(key);
    if (data != null) memory.set(key, data);
    else if (loadFromFile(key) != null) memory.set(key, loadFromFile(key));
  }
  dynamoReady = true;
  return { mode: "dynamodb", table: tableName(), stores: storeKeys };
}

module.exports = {
  readStore,
  writeStore,
  initPlatformStore,
  useDynamo,
  filePath,
};
