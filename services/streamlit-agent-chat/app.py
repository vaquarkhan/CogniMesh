"""
CogniMesh Agent Chat - Streamlit UI for Bedrock Agents.

Usage:
  streamlit run app.py -- --agent-id AGENT_ID --alias-id ALIAS_ID --region us-east-1

Environment:
  AWS credentials must be configured (profile, env vars, or IAM role).
  COGNIMESH_API_URL (optional) - API gateway URL for session logging.
"""

import os
import sys
import uuid
import argparse

import streamlit as st

# ---------------------------------------------------------------------------
# CLI args (passed after --)
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="CogniMesh Agent Chat")
    parser.add_argument("--agent-id", default=os.environ.get("AGENT_ID", ""))
    parser.add_argument("--alias-id", default=os.environ.get("AGENT_ALIAS_ID", "live"))
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    parser.add_argument("--agent-name", default=os.environ.get("AGENT_NAME", "CogniMesh Agent"))
    parser.add_argument("--port", default=os.environ.get("STREAMLIT_PORT", "8501"))
    # Streamlit passes its own args, so ignore unknown
    args, _ = parser.parse_known_args()
    return args


args = parse_args()
AGENT_ID = args.agent_id
ALIAS_ID = args.alias_id
REGION = args.region
AGENT_NAME = args.agent_name

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title=f"{AGENT_NAME} - CogniMesh",
    page_icon="🤖",
    layout="centered",
)

st.title(f"🤖 {AGENT_NAME}")
st.caption(f"Bedrock Agent `{AGENT_ID}` · alias `{ALIAS_ID}` · {REGION}")

# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------

if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())

if "messages" not in st.session_state:
    st.session_state.messages = []

# ---------------------------------------------------------------------------
# Bedrock Agent Runtime client
# ---------------------------------------------------------------------------

@st.cache_resource
def get_bedrock_client():
    import boto3
    return boto3.client("bedrock-agent-runtime", region_name=REGION)


def invoke_agent(user_message: str) -> str:
    """Invoke Bedrock Agent and stream the response."""
    if not AGENT_ID:
        return "⚠️ No agent-id configured. Set AGENT_ID env var or pass --agent-id."

    client = get_bedrock_client()

    try:
        response = client.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=ALIAS_ID,
            sessionId=st.session_state.session_id,
            inputText=user_message,
        )
    except client.exceptions.ResourceNotFoundException:
        return f"❌ Agent `{AGENT_ID}` not found in {REGION}. Check the agent ID and region."
    except client.exceptions.AccessDeniedException as e:
        return f"❌ Access denied: {e}. Check IAM permissions for bedrock-agent-runtime."
    except Exception as e:
        return f"❌ Error invoking agent: {e}"

    # Stream completion chunks
    chunks = []
    event_stream = response.get("completion", [])
    for event in event_stream:
        chunk = event.get("chunk", {})
        text = chunk.get("bytes", b"").decode("utf-8", errors="replace")
        if text:
            chunks.append(text)

    if not chunks:
        return "Agent returned an empty response."

    return "".join(chunks)

# ---------------------------------------------------------------------------
# Chat UI
# ---------------------------------------------------------------------------

# Render message history
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# User input
if prompt := st.chat_input("Ask the agent anything..."):
    # Display user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Get agent response
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = invoke_agent(prompt)
        st.markdown(response)

    st.session_state.messages.append({"role": "assistant", "content": response})

# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

with st.sidebar:
    st.subheader("Agent Details")
    st.code(f"Agent ID: {AGENT_ID}\nAlias: {ALIAS_ID}\nRegion: {REGION}\nSession: {st.session_state.session_id[:8]}...")

    if st.button("🔄 New Session"):
        st.session_state.session_id = str(uuid.uuid4())
        st.session_state.messages = []
        st.rerun()

    st.divider()
    st.caption("Powered by Amazon Bedrock Agents · CogniMesh")
