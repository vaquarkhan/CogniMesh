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
import { instantiateAgentTemplate, getAgentTemplateById } from "../lib/agent-templates";

const nodeTypes = { agent: AgentNode };

let agentNodeSeq = 0;
const nextAgentId = () => `agent-${++agentNodeSeq}`;

function snapshot(nodes, edges) {
  return { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
}

export default function AgentBuilderView({ userEmail, authDisabled, onLogout, bootstrap, onBootstrapApplied }) {
  const { success, error: toastError } = useToast();
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

  const validation = useMemo(() => validateAgentBlocks(nodes, edges), [nodes, edges]);

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
        "Manifest downloaded. Agent Builder is design-only - it does not call AWS Bedrock Agent APIs yet. Deploy with aws bedrock-agent create-agent, Terraform, or a future CogniMesh agent-deploy API.",
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
          {deployMessage && (
            <div className="agent-deploy-banner">
              <strong>{deployMessage.agentName}</strong> · {deployMessage.runtime} · {deployMessage.guardrails} guardrail(s) · {deployMessage.message}
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
