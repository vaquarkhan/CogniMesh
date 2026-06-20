"use strict";

/**
 * Launch Streamlit agent chat UI for a deployed Bedrock agent.
 * Returns the URL where the chat interface is accessible.
 */

const { spawn } = require("child_process");
const path = require("path");
const net = require("net");

const STREAMLIT_APP = path.join(__dirname, "../../services/streamlit-agent-chat/app.py");
const BASE_PORT = parseInt(process.env.STREAMLIT_BASE_PORT || "8501", 10);
const MAX_PORT_ATTEMPTS = 20;

// Track running Streamlit processes per agentId
const running = new Map();

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;

    function tryPort() {
      if (attempts >= MAX_PORT_ATTEMPTS) {
        reject(new Error(`No free port found between ${startPort} and ${startPort + MAX_PORT_ATTEMPTS}`));
        return;
      }
      const server = net.createServer();
      server.listen(port, "0.0.0.0", () => {
        server.close(() => resolve(port));
      });
      server.on("error", () => {
        port++;
        attempts++;
        tryPort();
      });
    }

    tryPort();
  });
}

/**
 * Launch Streamlit for a given agent deployment.
 * @param {{ agentId, aliasId, region, agentName }} opts
 * @returns {Promise<{ url: string, port: number, pid: number }>}
 */
async function launchStreamlitChat({ agentId, aliasId, region, agentName }) {
  if (!agentId) throw new Error("agentId is required to launch Streamlit chat");

  // Reuse existing instance for same agent
  if (running.has(agentId)) {
    const existing = running.get(agentId);
    return { url: existing.url, port: existing.port, pid: existing.pid, reused: true };
  }

  const port = await findFreePort(BASE_PORT);
  const host = process.env.STREAMLIT_HOST || "0.0.0.0";
  const baseUrl = process.env.STREAMLIT_BASE_URL || `http://localhost:${port}`;

  const args = [
    "run", STREAMLIT_APP,
    "--server.port", String(port),
    "--server.address", host,
    "--server.headless", "true",
    "--browser.gatherUsageStats", "false",
    "--",
    "--agent-id", agentId,
    "--alias-id", aliasId || "live",
    "--region", region || process.env.AWS_REGION || "us-east-1",
    "--agent-name", agentName || "CogniMesh Agent",
  ];

  const child = spawn("streamlit", args, {
    cwd: path.dirname(STREAMLIT_APP),
    env: { ...process.env, AGENT_ID: agentId, AGENT_ALIAS_ID: aliasId || "live" },
    stdio: "pipe",
    detached: false,
  });

  const url = baseUrl.includes("localhost") ? `http://localhost:${port}` : baseUrl;

  const entry = { url, port, pid: child.pid, agentId, process: child };
  running.set(agentId, entry);

  child.on("exit", () => {
    running.delete(agentId);
  });

  child.on("error", (err) => {
    console.error(`[streamlit-launcher] Failed to start Streamlit for ${agentId}:`, err.message);
    running.delete(agentId);
  });

  // Give Streamlit a moment to bind the port
  await new Promise((r) => setTimeout(r, 2000));

  return { url, port, pid: child.pid, reused: false };
}

/**
 * Stop a running Streamlit instance for an agent.
 */
function stopStreamlitChat(agentId) {
  const entry = running.get(agentId);
  if (!entry) return false;
  try {
    entry.process.kill("SIGTERM");
  } catch { /* ignore */ }
  running.delete(agentId);
  return true;
}

function getStreamlitUrl(agentId) {
  const entry = running.get(agentId);
  return entry?.url || null;
}

function listRunningChats() {
  return [...running.entries()].map(([id, e]) => ({
    agentId: id,
    url: e.url,
    port: e.port,
    pid: e.pid,
  }));
}

module.exports = {
  launchStreamlitChat,
  stopStreamlitChat,
  getStreamlitUrl,
  listRunningChats,
};
