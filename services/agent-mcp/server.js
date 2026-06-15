/**
 * CogniMesh Agent MCP - Bedrock integration for agentic transforms
 */
require("dotenv").config();

const http = require("http");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const PORT = process.env.PORT || 3100;
const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:8080";

const bedrock = new BedrockRuntimeClient({ region: REGION });

const tools = [
  {
    name: "cognimesh_invoke_agent",
    description: "Invoke Bedrock agentic transform for a media asset",
    inputSchema: {
      type: "object",
      properties: {
        pipelineId: { type: "string" },
        mediaUri: { type: "string" },
        idempotencyKey: { type: "string" },
        prompt: { type: "string" },
      },
      required: ["pipelineId", "mediaUri", "idempotencyKey"],
    },
  },
  {
    name: "cognimesh_list_products",
    description: "List registered data products in the CogniMesh marketplace",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string" } },
    },
  },
];

async function invokeBedrockAgent({ pipelineId, mediaUri, idempotencyKey, prompt }) {
  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: prompt || `Extract structured JSON entities from media: ${mediaUri}. Pipeline: ${pipelineId}. Key: ${idempotencyKey}`,
      },
    ],
  });

  try {
    const res = await bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body,
      })
    );
    const text = JSON.parse(Buffer.from(res.body).toString());
    return { ok: true, modelId: MODEL_ID, result: text };
  } catch (err) {
    return {
      ok: false,
      stub: true,
      modelId: MODEL_ID,
      message: err.message,
      result: {
        mediaUri,
        pipelineId,
        idempotencyKey,
        entities: [],
        note: "Bedrock unavailable; returning stub for local dev",
      },
    };
  }
}

async function listProducts(domain) {
  const url = domain ? `${CATALOG_URL}/api/v1/products?domain=${domain}` : `${CATALOG_URL}/api/v1/products`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    return { error: err.message, products: [] };
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.url === "/health") {
    return json(200, { status: "ok", service: "cognimesh-agent-mcp", bedrock: MODEL_ID });
  }

  if (req.url === "/mcp/tools" && req.method === "GET") {
    return json(200, { tools });
  }

  if (req.url === "/mcp/invoke" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const result = await invokeBedrockAgent(body);
      return json(200, result);
    } catch (e) {
      return json(400, { error: e.message });
    }
  }

  if (req.url?.startsWith("/mcp/products") && req.method === "GET") {
    const domain = new URL(req.url, `http://localhost:${PORT}`).searchParams.get("domain");
    const products = await listProducts(domain);
    return json(200, products);
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`CogniMesh Agent MCP (Bedrock) on :${PORT}`);
});
