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

import DesignerSidebar from "./components/DesignerSidebar";
import AgentBuilderView from "./components/AgentBuilderView";
import PipelineNode from "./components/PipelineNode";
import PropertiesPanel from "./components/PropertiesPanel";
import DeployPanel from "./components/DeployPanel";
import MarketplacePanel from "./components/MarketplacePanel";
import LineageCatalogPanel from "./components/LineageCatalogPanel";
import ExecutionHistoryPanel from "./components/ExecutionHistoryPanel";
import DeployConfirmModal from "./components/DeployConfirmModal";
import WelcomeModal from "./components/WelcomeModal";
import StewardApprovalsPanel from "./components/StewardApprovalsPanel";
import CanvasTipBar from "./components/CanvasTipBar";
import MeshSwimlanes from "./components/MeshSwimlanes";
import ToastStack, { useToast } from "./components/Toast";
import MobileWarning from "./components/MobileWarning";
import LoadingOverlay from "./components/LoadingOverlay";
import { deployPipeline, previewPipeline, runAwsDesignReview, isApiReachable } from "./lib/api";
import AwsDesignReviewHUD from "./components/AwsDesignReviewHUD";
import { validateBlocks, isWorkflowGraph } from "./lib/validate-blocks";
import { formatApiErrors } from "./lib/format-api-errors";
import { useAuth } from "./auth/AuthContext";
import { instantiatePattern, getPatternById } from "./lib/pipeline-patterns";

const nodeTypes = { pipeline: PipelineNode };

let nodeId = 0;
const nextId = () => `node-${++nodeId}`;

function snapshot(nodes, edges) {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

function deriveWorkflowStep(nodes, blockValidation, selectedId, hasPreviewed) {
  if (!nodes.length) return "pick";
  if (!blockValidation.valid) return "connect";
  if (selectedId) return "customize";
  if (!hasPreviewed) return "preview";
  return "deploy";
}

function deriveTipVariant(nodes, blockValidation) {
  if (!nodes.length) return "empty";
  if (!blockValidation.valid) return "invalid";
  if (isWorkflowGraph(nodes)) return "workflow";
  return "ready";
}

export default function App() {
  const { token, userEmail, logout, authDisabled } = useAuth();
  const { toasts, success, error: toastError } = useToast();
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [history, setHistory] = useState([snapshot([], [])]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [pipelineMeta, setPipelineMeta] = useState({
    name: "my-pipeline",
    domain: "my-domain",
    version: "1.0.0",
    schemaEvolutionPolicy: "compatible",
    piiClassification: "medium",
  });
  const [activePatternId, setActivePatternId] = useState(null);
  const [patternTips, setPatternTips] = useState([]);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return !localStorage.getItem("cognimesh_welcome_seen");
    } catch {
      return true;
    }
  });
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Working…");
  const [showDeploy, setShowDeploy] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showLineageCatalog, setShowLineageCatalog] = useState(false);
  const [showExecutionHistory, setShowExecutionHistory] = useState(false);
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  const [showStewardApprovals, setShowStewardApprovals] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [awsReview, setAwsReview] = useState(null);
  const [awsReviewLoading, setAwsReviewLoading] = useState(false);
  const [awsReviewExpanded, setAwsReviewExpanded] = useState(true);
  const [designerMode, setDesignerMode] = useState("pipeline");
  const [agentBootstrap, setAgentBootstrap] = useState(null);
  const reactFlowInstance = useRef(null);

  const blockValidation = useMemo(() => validateBlocks(nodes, edges), [nodes, edges]);
  const workflowStep = useMemo(
    () => deriveWorkflowStep(nodes, blockValidation, selectedId, hasPreviewed),
    [nodes, blockValidation, selectedId, hasPreviewed]
  );
  const tipVariant = deriveTipVariant(nodes, blockValidation);

  const nodesWithValidation = useMemo(() => {
    const reviewByNode = awsReview?.findingsByNode || {};
    return nodes.map((n) => {
      const issues = reviewByNode[n.id] || [];
      const topIssue = issues.find((f) => f.severity === "critical") || issues.find((f) => f.severity === "high") || issues[0];
      return {
        ...n,
        data: {
          ...n.data,
          validationError: blockValidation.byNode[n.id] || null,
          awsReviewCount: issues.length,
          awsReviewSeverity: topIssue?.severity || null,
          awsReviewTitle: topIssue?.title || null,
        },
      };
    });
  }, [nodes, blockValidation.byNode, awsReview?.findingsByNode]);

  const runDesignReviewScan = useCallback(async () => {
    if (!nodes.length) {
      setAwsReview(null);
      return;
    }
    const apiUp = await isApiReachable();
    if (!apiUp) {
      setAwsReview(null);
      return;
    }
    setAwsReviewLoading(true);
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const result = await runAwsDesignReview({ nodes, edges, pipelineMeta: meta, token });
      setAwsReview(result?.status === "success" ? result : null);
    } catch {
      setAwsReview(null);
    } finally {
      setAwsReviewLoading(false);
    }
  }, [nodes, edges, pipelineMeta, token, userEmail]);

  useEffect(() => {
    const t = setTimeout(runDesignReviewScan, 500);
    return () => clearTimeout(t);
  }, [runDesignReviewScan]);

  const focusCanvasNode = useCallback((nodeId) => {
    setSelectedId(nodeId);
    const inst = reactFlowInstance.current;
    const node = nodes.find((n) => n.id === nodeId);
    if (inst && node) {
      inst.setCenter(node.position.x + 80, node.position.y + 40, { zoom: 1.2, duration: 400 });
    }
  }, [nodes]);
  const launchAgentBuilder = useCallback((instance, label) => {
    setAgentBootstrap(instance);
    setDesignerMode("agent");
    success(`Opening Agent Builder: ${label || instance.agentMeta?.name || "agent"}`);
  }, [success]);

  const applyPattern = useCallback(
    (instance) => {
      nodeId = instance.nodes.length;
      setNodes(instance.nodes);
      setEdges(instance.edges);
      setPipelineMeta(instance.pipelineMeta);
      setActivePatternId(instance.patternId);
      setPatternTips(instance.tips || []);
      setHasPreviewed(false);
      setSelectedId(null);
      setDeployError(null);
      const snap = snapshot(instance.nodes, instance.edges);
      setHistory([snap]);
      setHistoryIndex(0);
      const pattern = getPatternById(instance.patternId);
      success(`Loaded: ${pattern?.name || instance.pipelineMeta.name}`);
    },
    [setNodes, setEdges, success]
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
      const raw = event.dataTransfer.getData("application/cognimesh-block");
      if (!raw) return;

      const block = JSON.parse(raw);
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 80,
        y: event.clientY - bounds.top - 30,
      };

      const blockType = block.defaults.blockType;
      const existingStart = nodes.find((n) => n.data.blockType === "start");
      if (blockType === "start" && existingStart) {
        const msg = "Only one Start block is allowed.";
        setDeployError([msg]);
        toastError(msg);
        return;
      }

      const newNode = {
        id: nextId(),
        type: "pipeline",
        position,
        data: { ...block.defaults },
      };

      setNodes((nds) => {
        const next = nds.concat(newNode);
        pushHistory(next, edges);
        return next;
      });
      setDeployError(null);
    },
    [nodes, edges, setNodes, pushHistory, toastError]
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

  const selectedNode = nodesWithValidation.find((n) => n.id === selectedId) || null;

  const handlePreview = async () => {
    if (!nodes.length) {
      toastError("Load a pattern or add blocks first");
      return;
    }
    setLoading(true);
    setLoadingMessage("Generating contract preview…");
    setDeployError(null);
    setShowDeploy(true);
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const result = await previewPipeline({ nodes, edges, pipelineMeta: meta, token });
      if (result.status === "success") {
        setDeployResult({ ...result, status: "success", catalog: null });
        setDeployError(null);
        setHasPreviewed(true);
        success("Preview ready - review YAML before deploy");
      } else {
        const errs = formatApiErrors(result);
        setDeployResult({ ...result, status: "error" });
        setDeployError(errs);
        toastError(errs[0] || "Preview failed");
      }
    } catch (err) {
      setDeployError([err.message]);
      toastError(err.message || "API unavailable");
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!nodes.length) {
      toastError("Load a pattern or add blocks first");
      return;
    }
    if (!blockValidation.valid) {
      setDeployError(blockValidation.errors);
      toastError("Fix block validation errors before deploy");
      return;
    }
    if (awsReview?.overall?.deployBlocked) {
      setAwsReviewExpanded(true);
      toastError(`${awsReview.overall.criticalCount} critical AWS issue(s) - fix in Design Review`);
      return;
    }
    setShowDeployConfirm(true);
  };

  const confirmDeploy = async () => {
    setShowDeployConfirm(false);
    setLoading(true);
    setLoadingMessage("Deploying pipeline…");
    setDeployError(null);
    setShowDeploy(true);
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const { ok, data } = await deployPipeline({ nodes, edges, pipelineMeta: meta, token });
      if (ok) {
        setDeployResult(data);
        setDeployError(null);
        setCatalogRefresh((k) => k + 1);
        setShowExecutionHistory(true);
        setShowMarketplace(true);
        success("Pipeline deployed successfully");
      } else {
        const errs = data.errors || data.validation?.errors || data.integrityGate?.errors || ["Deploy failed"];
        setDeployError(errs);
        setDeployResult(data.contract ? data : null);
        toastError("Deploy blocked - see panel for details");
      }
    } catch (err) {
      setDeployError([err.message]);
      toastError(err.message || "Cannot reach API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key === "s") {
        e.preventDefault();
        handlePreview();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="app">
      <MobileWarning />
      <ToastStack toasts={toasts} />
      {loading && <LoadingOverlay message={loadingMessage} />}

      <WelcomeModal
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        onApplyPattern={applyPattern}
      />

      <DeployConfirmModal
        open={showDeployConfirm}
        pipelineName={pipelineMeta.name}
        awsReview={awsReview}
        onConfirm={confirmDeploy}
        onCancel={() => setShowDeployConfirm(false)}
      />

      <header className="header">
        <div>
          <h1>CogniMesh</h1>
          <p className="subtitle">
            {designerMode === "pipeline"
              ? "Step Functions–style workflow · many sources · parallel · choice"
              : "Amazon Bedrock AgentCore · drag-drop agents · guardrails · templates"}
          </p>
          <div className="designer-mode-switch">
            <button
              type="button"
              className={designerMode === "pipeline" ? "active" : ""}
              onClick={() => setDesignerMode("pipeline")}
            >
              Data Pipeline
            </button>
            <button
              type="button"
              className={designerMode === "agent" ? "active" : ""}
              onClick={() => setDesignerMode("agent")}
            >
              Agent Builder
            </button>
          </div>
        </div>
        {designerMode === "pipeline" && (
        <div className="header-actions">
          {!authDisabled && userEmail && <span className="user-badge">{userEmail}</span>}
          <button className="btn-secondary" type="button" onClick={undo} disabled={historyIndex <= 0}>
            Undo
          </button>
          <button className="btn-secondary" type="button" onClick={redo} disabled={historyIndex >= history.length - 1}>
            Redo
          </button>
          <button className="btn-secondary" type="button" onClick={() => setShowStewardApprovals((v) => !v)}>
            Approvals
          </button>
          <button className="btn-secondary" type="button" onClick={() => setAwsReviewExpanded((v) => !v)}>
            AWS Review
            {awsReview?.overall?.score != null && (
              <span className={`header-score ${awsReview.overall.deployBlocked ? "score-bad" : "score-ok"}`}>
                {awsReview.overall.score}
              </span>
            )}
          </button>
          <button className="btn-secondary" type="button" onClick={() => setShowExecutionHistory((v) => !v)}>
            Run History
          </button>
          <button className="btn-secondary" type="button" onClick={() => setShowLineageCatalog((v) => !v)}>
            Lineage
          </button>
          <button className="btn-secondary" type="button" onClick={() => setShowMarketplace((v) => !v)}>
            Marketplace
          </button>
          <button className="btn-secondary" type="button" onClick={handlePreview} disabled={loading}>
            Preview YAML
          </button>
          <button className="deploy-btn" type="button" onClick={handleDeploy} disabled={loading}>
            Deploy Pipeline
          </button>
          {!authDisabled && (
            <button className="btn-secondary" type="button" onClick={logout}>
              Sign out
            </button>
          )}
        </div>
        )}
      </header>

      {designerMode === "agent" ? (
        <AgentBuilderView
          userEmail={userEmail}
          authDisabled={authDisabled}
          onLogout={logout}
          bootstrap={agentBootstrap}
          onBootstrapApplied={() => setAgentBootstrap(null)}
        />
      ) : (
      <div className="main">
        <DesignerSidebar
          activePatternId={activePatternId}
          workflowStep={workflowStep}
          patternTips={patternTips}
          onApplyPattern={applyPattern}
          onLaunchAgent={launchAgentBuilder}
          token={token}
        />

        <div className="canvas-column">
          {!tipDismissed && (
            <CanvasTipBar
              variant={tipVariant}
              onDismiss={tipVariant === "ready" ? () => setTipDismissed(true) : undefined}
            />
          )}

          <div className="canvas" ref={reactFlowWrapper}>
            {activePatternId === "arch-datamesh-multi-domain" && <MeshSwimlanes />}
            {nodes.length === 0 && (
              <div className="canvas-empty-overlay">
                <p className="canvas-empty-title">No pipeline yet</p>
                <p>Select a pattern from the left → <strong>Patterns</strong> tab → <strong>Use pattern</strong></p>
                <button
                  type="button"
                  className="deploy-btn"
                  onClick={() => applyPattern(instantiatePattern(getPatternById("multi-source-mesh")))}
                >
                  Load: Multi-Source workflow (Parallel → Choice)
                </button>
              </div>
            )}

            <ReactFlow
              nodes={nodesWithValidation}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={(inst) => {
                reactFlowInstance.current = inst;
              }}
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
                    start: "#10b981",
                    parallel: "#fb923c",
                    merge: "#fdba74",
                    choice: "#22d3ee",
                    map: "#a78bfa",
                    pass: "#94a3b8",
                    integrity_gate: "#f87171",
                    source: "#059669",
                    transform: "#2563eb",
                    sink: "#ea580c",
                  };
                  return c[n.data?.blockType] || "#6b7280";
                }}
              />
            </ReactFlow>

            <AwsDesignReviewHUD
              review={awsReview}
              loading={awsReviewLoading}
              expanded={awsReviewExpanded}
              onToggleExpand={() => setAwsReviewExpanded((v) => !v)}
              onFocusNode={focusCanvasNode}
              onRunReview={runDesignReviewScan}
            />
          </div>
        </div>

        <PropertiesPanel
          node={selectedNode}
          onChange={updateNode}
          pipelineMeta={pipelineMeta}
          onMetaChange={setPipelineMeta}
          awsFindings={selectedId ? awsReview?.findingsByNode?.[selectedId] : null}
        />

        {showStewardApprovals && <StewardApprovalsPanel token={token} refreshKey={catalogRefresh} />}

        {showMarketplace && <MarketplacePanel token={token} refreshKey={catalogRefresh} />}

        {showLineageCatalog && <LineageCatalogPanel token={token} refreshKey={catalogRefresh} />}

        {showExecutionHistory && (
          <ExecutionHistoryPanel
            token={token}
            pipelineName={pipelineMeta.name}
            domain={pipelineMeta.domain}
            refreshKey={catalogRefresh}
          />
        )}

        {showDeploy && <DeployPanel result={deployResult} loading={loading} error={deployError} token={token} />}
      </div>
      )}
    </div>
  );
}
