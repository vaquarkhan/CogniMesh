import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import AgentDesignerSidebar from "./AgentDesignerSidebar";
import AgentNode from "./AgentNode";
import AgentPropertiesPanel from "./AgentPropertiesPanel";
import AgentPreviewPanel from "./AgentPreviewPanel";
import { useToast } from "./Toast";
import { validateAgentBlocks } from "../lib/validate-agent-blocks";
import { exportAgentManifest, downloadAgentManifest } from "../lib/agent-export";
import { deployAgentManifest } from "../lib/platform-api";
import { downloadZip } from "../lib/zip-download";
import { getApiHealth } from "../lib/api";
import { validateAgentInstruction } from "../lib/agent-instruction";
import { bedrockAgentConsoleUrl } from "../lib/aws-console-urls";
import { instantiateAgentTemplate, getAgentTemplateById } from "../lib/agent-templates";

const nodeTypes = { agent: AgentNode };

let agentNodeSeq = 0;
const nextAgentId = () => `agent-${++agentNodeSeq}`;

function snapshot(nodes, edges) {
  return { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
}

export default function AgentBuilderView({
  userEmail,
  authDisabled,
  onLogout,
  token,
  bootstrap,
  onBootstrapApplied,
  notify,
  defaultDeployTarget = "bedrock-agents",
}) {
  const internalToast = useToast();
  const success = notify?.success ?? internalToast.success;
  const toastError = notify?.error ?? internalToast.error;
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [history, setHistory] = useState([snapshot([], [])]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [agentMeta, setAgentMeta] = useState({
    name: "my-agent",
    domain: "default",
    version: "1.0.0",
    description: "",
  });
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [templateTips, setTemplateTips] = useState([]);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [deployMessage, setDeployMessage] = useState(null);
  const [deployLoading, setDeployLoading] = useState(false);
  const [agentDeployCheck, setAgentDeployCheck] = useState(null);
  const [deployTarget, setDeployTarget] = useState(defaultDeployTarget);

  const validation = useMemo(() => validateAgentBlocks(nodes, edges), [nodes, edges]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await getApiHealth();
        if (!cancelled) setAgentDeployCheck(health?.checks?.aws_agent_deploy || null);
      } catch {
        if (!cancelled) setAgentDeployCheck(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const nodesWithValidation = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          validationError: validation.byNode[n.id] || null,
        },
      })),
    [nodes, validation.byNode]
  );

  const pushHistory = useCallback(
    (nextNodes, nextEdges) => {
      const snap = snapshot(nextNodes, nextEdges);
      setHistory((h) => {
        const trimmed = h.slice(0, historyIndex + 1);
        return [...trimmed, snap].slice(-30);
      });
      setHistoryIndex((i) => Math.min(i + 1, 29));
    },
    [historyIndex]
  );

  const applyTemplate = useCallback(
    (instance) => {
      agentNodeSeq = instance.nodes.length;
      setNodes(instance.nodes);
      setEdges(instance.edges);
      setAgentMeta(instance.agentMeta);
      setActiveTemplateId(instance.templateId);
      setTemplateTips(instance.tips || []);
      setSelectedId(null);
      setPreviewError(null);
      setDeployMessage(null);
      const snap = snapshot(instance.nodes, instance.edges);
      setHistory([snap]);
      setHistoryIndex(0);
      const template = getAgentTemplateById(instance.templateId);
      success(`Loaded: ${template?.name || instance.agentMeta.name}`);
    },
    [setNodes, setEdges, success]
  );

  useEffect(() => {
    if (bootstrap?.nodes?.length) {
      applyTemplate(bootstrap);
      onBootstrapApplied?.();
    }
  }, [bootstrap, applyTemplate, onBootstrapApplied]);

  const undo = () => {
    if (historyIndex <= 0) return;
    const next = historyIndex - 1;
    setHistoryIndex(next);
    setNodes(history[next].nodes);
    setEdges(history[next].edges);
    success("Undo");
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    setHistoryIndex(next);
    setNodes(history[next].nodes);
    setEdges(history[next].edges);
    success("Redo");
  };

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => {
        const next = addEdge({ ...params, animated: true }, eds);
        pushHistory(nodes, next);
        return next;
      });
    },
    [nodes, setEdges, pushHistory]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/cognimesh-agent-block");
      if (!raw) return;

      const block = JSON.parse(raw);
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 80,
        y: event.clientY - bounds.top - 30,
      };

      const newNode = {
        id: nextAgentId(),
        type: "agent",
        position,
        data: { ...block.defaults },
      };

      setNodes((nds) => {
        const next = nds.concat(newNode);
        pushHistory(next, edges);
        return next;
      });
    },
    [edges, setNodes, pushHistory]
  );

  const updateNode = useCallback(
    (id, patch) => {
      setNodes((nds) => {
        const next = nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        );
        pushHistory(next, edges);
        return next;
      });
    },
    [edges, setNodes, pushHistory]
  );

  const handlePreview = () => {
    if (!nodes.length) {
      toastError("Load a template or add AgentCore blocks first");
      return;
    }
    const v = validateAgentBlocks(nodes, edges);
    if (!v.valid) {
      setPreviewError(v.errors);
      setShowPreview(true);
      toastError(v.errors[0]);
      return;
    }
    const result = exportAgentManifest({ nodes, edges, agentMeta });
    setPreviewResult(result);
    setPreviewError(v.warnings.length ? v.warnings : null);
    setShowPreview(true);
    success("AgentCore manifest ready");
  };

  const handleDeployToAws = async () => {
    const instructionCheck = validateAgentInstruction(agentMeta.description);
    if (!instructionCheck.valid) {
      toastError(instructionCheck.message);
      return;
    }
    if (!validation.valid) {
      toastError(validation.errors[0] || "Fix validation errors before deploy");
      return;
    }
    const result = exportAgentManifest({ nodes, edges, agentMeta });
    setDeployLoading(true);
    setDeployMessage(null);
    try {
      const data = await deployAgentManifest(token, result.manifest, deployTarget);
      if (!data) {
        toastError("Agent deploy API unavailable");
        return;
      }
      // AgentCore Runtime branch
      if (deployTarget === "agentcore-runtime") {
        setDeployMessage({
          status: data.deployed ? "deployed" : data.generated ? "generated" : "failed",
          target: "agentcore-runtime",
          agentName: agentMeta.name,
          framework: data.framework,
          model: data.model,
          agentRuntimeArn: data.agentRuntimeArn || null,
          consoleUrl: data.consoleUrl || null,
          project: data.project || null,
          projectFiles: data.projectFiles || [],
          nextSteps: data.nextSteps || [],
          message: data.message || data.reason || data.errors?.[0] || "AgentCore Runtime finished",
        });
        if (data.deployed) success(`AgentCore Runtime created: ${data.agentRuntimeId || agentMeta.name}`);
        else if (data.generated) success("AgentCore Runtime project generated");
        else toastError(data.errors?.[0] || "AgentCore Runtime deploy failed");
        return;
      }
      setDeployMessage({
        status: data.deployed ? "deployed" : data.simulated ? "simulated" : data.partial ? "partial" : "failed",
        agentName: agentMeta.name,
        agentId: data.agentId,
        agentArn: data.agentArn,
        consoleUrl: data.agentArn ? bedrockAgentConsoleUrl(data.agentArn) : null,
        chatUrl: data.chatUrl || null,
        message: data.message || data.reason || (data.errors?.[0]) || "Deploy finished",
        plan: data.plan,
      });
      if (data.deployed || data.simulated) {
        success(
          data.deployed
            ? `Agent deployed: ${data.agentId}`
            : "Agent deploy simulated - configure API for Bedrock (see banner)"
        );
        if (!data.simulated) {
          try {
            const health = await getApiHealth();
            setAgentDeployCheck(health?.checks?.aws_agent_deploy || null);
          } catch {
            /* ignore */
          }
        }
      } else if (data.partial && data.agentId) {
        toastError(`Agent ${data.agentId} created but alias failed: ${data.errors?.[0] || "see banner"}`);
      } else {
        toastError(data.errors?.[0] || "Agent deploy failed");
      }
    } catch (err) {
      toastError(err.message || "Deploy API unavailable");
    } finally {
      setDeployLoading(false);
    }
  };

  const handleExportManifest = () => {
    if (!validation.valid) {
      toastError(validation.errors[0] || "Fix validation errors before export");
      return;
    }
    const result = exportAgentManifest({ nodes, edges, agentMeta });
    downloadAgentManifest(result.yaml, agentMeta.name);
    setDeployMessage({
      status: "exported",
      agentName: agentMeta.name,
      runtime: result.manifest?.spec?.runtime?.framework,
      guardrails: result.manifest?.spec?.guardrails?.length || 0,
      message:
        "Manifest downloaded. Use Deploy to AWS for Bedrock CreateAgent (simulated locally unless AWS_AGENT_DEPLOY_ENABLED=true).",
    });
    success(`Manifest exported for "${agentMeta.name}"`);
  };

  const selectedNode = nodesWithValidation.find((n) => n.id === selectedId) || null;

  return (
    <>
      <div className="agent-toolbar">
        {!authDisabled && userEmail && <span className="user-badge">{userEmail}</span>}
        <button className="btn-secondary" type="button" onClick={undo} disabled={historyIndex <= 0}>
          Undo
        </button>
        <button className="btn-secondary" type="button" onClick={redo} disabled={historyIndex >= history.length - 1}>
          Redo
        </button>
        <button className="btn-secondary" type="button" onClick={handlePreview}>
          Preview manifest
        </button>
        <button className="deploy-btn agent-deploy-btn" type="button" onClick={handleExportManifest} disabled={!nodes.length}>
          Export manifest
        </button>
        <select
          className="agent-deploy-target-select"
          value={deployTarget}
          onChange={(e) => setDeployTarget(e.target.value)}
        >
          <option value="bedrock-agents">Bedrock Agents</option>
          <option value="agentcore-runtime">AgentCore Runtime (Strands)</option>
        </select>
        <button
          className="deploy-btn agent-deploy-btn"
          type="button"
          onClick={handleDeployToAws}
          disabled={!nodes.length || deployLoading}
        >
          {deployLoading ? "Deploying…" : "Deploy to AWS"}
        </button>
        {!authDisabled && onLogout && (
          <button className="btn-secondary" type="button" onClick={onLogout}>
            Sign out
          </button>
        )}
      </div>

      <div className="main agent-main">
        <AgentDesignerSidebar
          activeTemplateId={activeTemplateId}
          templateTips={templateTips}
          onApplyTemplate={applyTemplate}
        />

        <div className="canvas-column">
          {agentDeployCheck && !agentDeployCheck.enabled && (
            <div className="agent-deploy-banner agent-deploy-simulated">
              <strong>Bedrock deploy not configured on API</strong>
              <p className="properties-hint">
                {agentDeployCheck.message}
                {agentDeployCheck.hint ? ` (${agentDeployCheck.hint})` : ""}
              </p>
            </div>
          )}
          {deployMessage && (
            <div className={`agent-deploy-banner agent-deploy-${deployMessage.status}`}>
              <strong>
                {deployMessage.status === "deployed"
                  ? "Deployed to Bedrock"
                  : deployMessage.status === "simulated"
                    ? "Local simulation (not on AWS)"
                    : deployMessage.status === "partial"
                      ? "Agent created on Bedrock (alias step failed)"
                    : deployMessage.status === "exported"
                      ? "Manifest exported"
                      : "Deploy failed"}
              </strong>
              <span>
                {deployMessage.agentName}
                {deployMessage.agentId ? ` · ${deployMessage.agentId}` : ""}
              </span>
              {deployMessage.consoleUrl && (
                <a
                  href={deployMessage.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="aws-console-link"
                >
                  Open in Bedrock Agents Console ↗
                </a>
              )}
              {deployMessage.chatUrl && (
                <a
                  href={deployMessage.chatUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="aws-console-link agent-chat-link"
                >
                  💬 Open Agent Chat UI ↗
                </a>
              )}
              <p className="properties-hint">{deployMessage.message}</p>
              {deployMessage.target === "agentcore-runtime" && deployMessage.project && (
                <div className="agentcore-project">
                  <p className="properties-hint">Framework: <code>{deployMessage.framework}</code> · Model: <code>{deployMessage.model}</code></p>
                  <div className="agentcore-actions">
                    <button
                      type="button"
                      className="deploy-btn"
                      onClick={() => {
                        downloadZip(`${deployMessage.agentName || "agentcore-agent"}-agentcore`, deployMessage.project);
                        success("AgentCore project downloaded (.zip)");
                      }}
                    >
                      ⬇ Download project (.zip)
                    </button>
                    {deployMessage.agentRuntimeArn ? (
                      <a className="aws-console-link" href={deployMessage.consoleUrl || "#"} target="_blank" rel="noreferrer">Open AgentCore Runtime ↗</a>
                    ) : (
                      <span className="agentcore-deploy-hint">To deploy directly: unzip → run <code>./deploy.sh</code> (builds ARM64 image, pushes to ECR, calls CreateAgentRuntime). Requires Docker + an AgentCore runtime role.</span>
                    )}
                  </div>
                  <div className="agentcore-file-tabs">
                    {deployMessage.projectFiles.map((f) => (
                      <details key={f} className="agentcore-file">
                        <summary>{f}</summary>
                        <pre className="agentcore-file-body">{deployMessage.project[f]}</pre>
                      </details>
                    ))}
                  </div>
                </div>
              )}
              {deployMessage.status === "simulated" && deployMessage.plan?.steps?.length > 0 && (
                <ol className="aws-fix-steps">
                  {deployMessage.plan.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
              {deployMessage.status === "simulated" && agentDeployCheck?.hint && (
                <p className="properties-hint">
                  To deploy for real: set <code>AWS_BEDROCK_AGENT_ROLE_ARN</code> on the API server, restart API, then
                  click Deploy again. The agent chat UI will launch automatically.
                </p>
              )}
            </div>
          )}

          {!validation.valid && nodes.length > 0 && (
            <div className="canvas-tip-bar tip-invalid">
              {validation.errors[0]}
            </div>
          )}

          <div className="canvas agent-canvas" ref={reactFlowWrapper}>
            {nodes.length === 0 && (
              <div className="canvas-empty-overlay">
                <p className="canvas-empty-title">No agent yet</p>
                <p>Pick a template from the left → <strong>Templates</strong> tab → <strong>Use template</strong></p>
                <button
                  type="button"
                  className="deploy-btn"
                  onClick={() => applyTemplate(instantiateAgentTemplate(getAgentTemplateById("customer-support")))}
                >
                  Load: Customer Support Agent
                </button>
              </div>
            )}

            <ReactFlow
              nodes={nodesWithValidation}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={(inst) => { reactFlowInstance.current = inst; }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              fitView
              deleteKeyCode={["Backspace", "Delete"]}
            >
              <Background gap={20} color="#243044" />
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const c = {
                    runtime: "#6366f1",
                    supervisor: "#a78bfa",
                    foundation_model: "#3b82f6",
                    guardrail: "#f87171",
                    gateway: "#06b6d4",
                    knowledge_base: "#f59e0b",
                  };
                  return c[n.data?.blockType] || "#6b7280";
                }}
              />
            </ReactFlow>
          </div>
        </div>

        <AgentPropertiesPanel
          node={selectedNode}
          onChange={updateNode}
          agentMeta={agentMeta}
          onMetaChange={setAgentMeta}
          validation={validation}
        />

        {showPreview && (
          <AgentPreviewPanel
            result={previewResult}
            error={previewError}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    </>
  );
}
