# Tutorial: Deploying an Agent with Streamlit Chat UI

This guide walks through deploying a Bedrock Agent from CogniMesh and interacting with it via the Streamlit chat interface.

## Prerequisites

- AWS credentials configured (profile, env vars, or IAM role)
- Bedrock Agent already created in your AWS account
- Python 3.9+ with `streamlit` and `boto3` installed
- CogniMesh API gateway running (`npm run dev` or Docker Compose)

## 1. Configure Agent in the Portal

Open the **Agent Builder** panel in the portal and fill in:

| Field | Example |
|-------|---------|
| Agent ID | `ABCDE12345` |
| Alias ID | `live` (or your alias) |
| Region | `us-east-1` |
| Agent Name | `Commerce Assistant` |

Click **Deploy** to register the agent with the platform.

## 2. Automatic Streamlit Launch

After a successful deploy, CogniMesh automatically launches a Streamlit chat UI. The launcher:

1. Finds a free port starting at `8501`
2. Spawns `streamlit run services/streamlit-agent-chat/app.py` with the agent config
3. Returns the URL (e.g., `http://localhost:8501`)

The portal shows a **Chat** button linking directly to the Streamlit UI.

## 3. Using the Chat Interface

The Streamlit app provides:

- **Chat input**: Type a message and press Enter to send it to the Bedrock Agent
- **Streaming response**: The agent's response streams back in real time
- **Session management**: Click "New Session" in the sidebar to reset conversation history
- **Agent details**: Sidebar shows agent ID, alias, region, and session ID

## 4. Manual Launch (Optional)

If you need to launch the chat UI manually:

```bash
cd services/streamlit-agent-chat
streamlit run app.py -- \
  --agent-id ABCDE12345 \
  --alias-id live \
  --region us-east-1 \
  --agent-name "Commerce Assistant"
```

Or set environment variables:

```bash
export AGENT_ID=ABCDE12345
export AGENT_ALIAS_ID=live
export AWS_REGION=us-east-1
streamlit run app.py
```

## 5. API Endpoints

The API gateway exposes agent lifecycle endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agents/deploy` | Deploy agent + launch chat |
| GET | `/api/v1/agents/:id/chat-url` | Get Streamlit URL for agent |
| POST | `/api/v1/agents/:id/stop` | Stop Streamlit process |
| GET | `/api/v1/agents/running` | List all running chat UIs |

## 6. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAMLIT_BASE_PORT` | `8501` | Starting port for allocation |
| `STREAMLIT_HOST` | `0.0.0.0` | Bind address |
| `STREAMLIT_BASE_URL` | `http://localhost:{port}` | Base URL (override for remote) |
| `COGNIMESH_API_URL` | — | API gateway URL for session logging |

## Troubleshooting

- **"No agent-id configured"**: Ensure `AGENT_ID` env var or `--agent-id` CLI arg is set
- **Access denied**: Check IAM permissions for `bedrock-agent-runtime:InvokeAgent`
- **Port in use**: The launcher auto-increments the port (up to 20 attempts)
- **Agent not found**: Verify the agent ID and region match your AWS account
