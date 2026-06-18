import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";

import DesignerSidebar from "./components/DesignerSidebar";
import PropertiesPanel from "./components/PropertiesPanel";
import DeployConfirmModal from "./components/DeployConfirmModal";
import FixIssuesWizardModal from "./components/FixIssuesWizardModal";
import WelcomeModal from "./components/WelcomeModal";
import CanvasTipBar from "./components/CanvasTipBar";
import MeshSwimlanes from "./components/MeshSwimlanes";
import ToastStack, { useToast } from "./components/Toast";
import MobileWarning from "./components/MobileWarning";
import LoadingOverlay from "./components/LoadingOverlay";
import ErrorBoundary from "./components/ErrorBoundary";
import HeaderDockMenu from "./components/HeaderDockMenu";
import { createNodeIdFactory } from "./lib/node-id";
import { deployPipeline, previewPipeline, runAwsDesignReview, isApiReachable, getApiHealth, getDesignReviewFixHelp } from "./lib/api";
import { insertIntegrityGate } from "./lib/integrity-gate-insert";
import { resolveAutoFix, resolvePlanActions } from "./lib/aws-fix-apply";
import { buildClientFixPlan, mergeWizardFindings } from "./lib/client-fix-plan";
import {
  generateDrawioArchitecture,
  generatePipelineTerraform,
  downloadTextFile,
} from "./lib/infrastructure-export";
import { normalizeGraphNodes, normalizeNodeData } from "./lib/resource-provisioning";
import { DEFAULT_AWS_REGION } from "./lib/aws-regions";
import { analyzeImpact } from "./lib/platform-api";
import AwsDesignReviewHUD from "./components/AwsDesignReviewHUD";
import { validateBlocks, isWorkflowGraph } from "./lib/validate-blocks";
import { formatApiErrors } from "./lib/format-api-errors";
import { useAuth } from "./auth/AuthContext";
import { instantiatePattern, getPatternById } from "./lib/pipeline-patterns";

const AgentBuilderView = lazy(() => import("./components/AgentBuilderView"));
const DeployPanel = lazy(() => import("./components/DeployPanel"));
const MarketplacePanel = lazy(() => import("./components/MarketplacePanel"));
const LineageCatalogPanel = lazy(() => import("./components/LineageCatalogPanel"));
const ExecutionHistoryPanel = lazy(() => import("./components/ExecutionHistoryPanel"));
const StewardApprovalsPanel = lazy(() => import("./components/StewardApprovalsPanel"));
const PlatformOperationsPanel = lazy(() => import("./components/PlatformOperationsPanel"));
const PipelineFlow = lazy(() => import("./components/PipelineFlow"));

function PanelFallback() {
  return (
    <div className="panel-loading" role="status" aria-busy="true">
      Loading…
    </div>
  );
}

function deploySuccessToast(data) {
  if (data?.aws?.deployed) return "Pipeline deployed to AWS Step Functions";
  if (data?.status === "success") {
    return "Pipeline compiled locally (PVDM + catalog). AWS Step Functions not deployed - see Deploy panel.";
  }
  return "Pipeline deployed successfully";
}

const nodeIds = createNodeIdFactory();

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
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [history, setHistory] = useState([snapshot([], [])]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [pipelineMeta, setPipelineMeta] = useState({
    name: "my-pipeline",
    domain: "my-domain",
    version: "1.0.0",
    schemaEvolutionPolicy: "compatible",
    piiClassification: "medium",
    awsRegion: DEFAULT_AWS_REGION,
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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Working…");
  const [fixWizardOpen, setFixWizardOpen] = useState(false);
  const fixWizardAutoOpenedRef = useRef(null);
  const loading = previewLoading || deployLoading;
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  /** Right-dock panel: only one open at a time (ops, approvals, history, lineage, marketplace, deploy). */
  const [activeDock, setActiveDock] = useState(null);
  const toggleDock = useCallback((id) => {
    setActiveDock((prev) => (prev === id ? null : id));
  }, []);
  const closeAllDocks = useCallback(() => setActiveDock(null), []);
  const [deployImpact, setDeployImpact] = useState(null);
  const [deployImpactLoading, setDeployImpactLoading] = useState(false);
  const [apiHealth, setApiHealth] = useState(null);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [awsReview, setAwsReview] = useState(null);
  const [awsReviewError, setAwsReviewError] = useState(null);
  const [awsReviewLoading, setAwsReviewLoading] = useState(false);
  const [awsReviewExpanded, setAwsReviewExpanded] = useState(true);
  const [awsFocusFindingId, setAwsFocusFindingId] = useState(null);
  const [awsAutoLoadFixForId, setAwsAutoLoadFixForId] = useState(null);
  const [applyingFindingId, setApplyingFindingId] = useState(null);
  const [designerMode, setDesignerMode] = useState("pipeline");
  const [agentBootstrap, setAgentBootstrap] = useState(null);
  const reactFlowInstance = useRef(null);

  const blockValidation = useMemo(() => validateBlocks(nodes, edges), [nodes, edges]);
  const wizardFindings = useMemo(
    () =>
      mergeWizardFindings({
        awsFindings: awsReview?.findings || [],
        deployErrors: deployError || [],
        blockValidation: blockValidation.valid ? null : blockValidation,
      }),
    [awsReview?.findings, deployError, blockValidation]
  );
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
      setAwsReviewError(null);
      return;
    }
    const apiUp = await isApiReachable();
    if (!apiUp) {
      setAwsReview(null);
      setAwsReviewError({
        errors: ["API gateway is not reachable"],
        fixHint: "Run npm run dev:api (or npm run dev:minimal) and ensure the portal proxy points to port 4000.",
      });
      return;
    }
    setAwsReviewLoading(true);
    setAwsReviewError(null);
    setAwsFocusFindingId(null);
    setAwsAutoLoadFixForId(null);
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const result = await runAwsDesignReview({ nodes, edges, pipelineMeta: meta, token });
      if (result?.status === "success") {
        setAwsReview(result);
        setAwsReviewError(null);
        if (result.overall?.deployBlocked) setAwsReviewExpanded(true);
      } else {
        setAwsReview(null);
        setAwsReviewError(result);
      }
    } catch (err) {
      setAwsReview(null);
      setAwsReviewError({ errors: [err.message], fixHint: "Check the API terminal for errors, then click Re-scan." });
    } finally {
      setAwsReviewLoading(false);
    }
  }, [nodes, edges, pipelineMeta, token, userEmail]);

  useEffect(() => {
    const t = setTimeout(runDesignReviewScan, 1200);
    return () => clearTimeout(t);
  }, [runDesignReviewScan]);

  useEffect(() => {
    if (!awsReview?.reviewedAt || awsReviewLoading) return;
    const actionable = (awsReview.findings || []).filter(
      (f) => f.severity === "critical" || f.severity === "high"
    );
    if (!actionable.length || !awsReview.overall?.deployBlocked) return;
    if (fixWizardAutoOpenedRef.current === awsReview.reviewedAt) return;
    fixWizardAutoOpenedRef.current = awsReview.reviewedAt;
    setFixWizardOpen(true);
  }, [awsReview?.reviewedAt, awsReview?.overall?.deployBlocked, awsReview?.findings, awsReviewLoading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await getApiHealth();
        if (cancelled) return;
        setApiHealth(health);
        if (health?.region) {
          setPipelineMeta((m) =>
            m.awsRegion && m.awsRegion !== DEFAULT_AWS_REGION ? m : { ...m, awsRegion: health.region }
          );
        }
      } catch {
        if (!cancelled) setApiHealth(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
      const normalizedNodes = normalizeGraphNodes(instance.nodes);
      nodeIds.sync(normalizedNodes);
      setNodes(normalizedNodes);
      setEdges(instance.edges);
      setPipelineMeta({
        ...instance.pipelineMeta,
        awsRegion: instance.pipelineMeta?.awsRegion || DEFAULT_AWS_REGION,
      });
      setActivePatternId(instance.patternId);
      setPatternTips(instance.tips || []);
      setHasPreviewed(false);
      setSelectedId(null);
      setDeployError(null);
      const snap = snapshot(normalizedNodes, instance.edges);
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
        id: nodeIds.next(),
        type: "pipeline",
        position,
        data: normalizeNodeData({ ...block.defaults }),
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

  const addIntegrityGateToGraph = useCallback(() => {
    const result = insertIntegrityGate(nodes, edges, () => nodeIds.next());
    if (!result.added) {
      toastError(result.reason || "Could not add integrity gate");
      return false;
    }
    setNodes(result.nodes);
    setEdges(result.edges);
    pushHistory(result.nodes, result.edges);
    if (result.gateId) setSelectedId(result.gateId);
    success("Added Integrity Gate block — wire or re-scan AWS review");
    return true;
  }, [nodes, edges, setNodes, setEdges, pushHistory, success, toastError]);

  const applyAwsFindingFix = useCallback(
    async (finding) => {
      if (!finding?.id) return;
      setApplyingFindingId(finding.id);
      try {
        const meta = { ...pipelineMeta, ownerEmail: userEmail };
        const clientPlan = buildClientFixPlan(finding, nodes, meta);

        const applyAction = (action) => {
          if (action.type === "add_integrity_gate") {
            if (addIntegrityGateToGraph()) {
              success("Added Integrity Gate — re-scanning AWS review…");
              setTimeout(runDesignReviewScan, 400);
            } else {
              toastError("Could not add integrity gate — wire transform → sink first");
            }
            return true;
          }
          if (action.type === "pipelineMeta") {
            setPipelineMeta((m) => ({ ...m, ...action.patch }));
            success("Applied suggested fix — re-scanning AWS review…");
            setTimeout(runDesignReviewScan, 400);
            return true;
          }
          if (action.type === "node" && action.nodeId && action.patch) {
            updateNode(action.nodeId, action.patch);
            success("Applied suggested fix — re-scanning AWS review…");
            setTimeout(runDesignReviewScan, 400);
            return true;
          }
          return false;
        };

        const clientFix = resolveAutoFix(finding, nodes, meta);
        if (clientFix && applyAction(clientFix)) return;

        const clientPlanAction = resolvePlanActions(clientPlan);
        if (clientPlanAction && applyAction(clientPlanAction)) return;

        if (clientPlan?.propertyPatch && clientPlan.nodeId) {
          updateNode(clientPlan.nodeId, clientPlan.propertyPatch);
          success("Applied fix on canvas — re-scanning…");
          setTimeout(runDesignReviewScan, 400);
          return;
        }
        if (clientPlan?.pipelineMetaPatch) {
          setPipelineMeta((m) => ({ ...m, ...clientPlan.pipelineMetaPatch }));
          success("Applied pipeline settings — re-scanning…");
          setTimeout(runDesignReviewScan, 400);
          return;
        }

        let plan = null;
        try {
          const data = await getDesignReviewFixHelp({
            token,
            nodes,
            edges,
            pipelineMeta: { ...pipelineMeta, ownerEmail: userEmail },
            findingId: finding.id,
          });
          if (data?.status === "error") {
            throw new Error(data.errors?.[0] || "Fix help unavailable");
          }
          plan = data.plans?.[0];
        } catch (apiErr) {
          if (clientFix) throw apiErr;
          console.warn("Fix help API failed, using client rules only", apiErr);
        }

        const planAction = resolvePlanActions(plan);
        if (planAction && applyAction(planAction)) return;

        if (plan?.propertyPatch && plan.nodeId) {
          updateNode(plan.nodeId, plan.propertyPatch);
          success("Applied suggested fix — re-scanning AWS review…");
          setTimeout(runDesignReviewScan, 400);
          return;
        }

        toastError(
          clientPlan?.steps?.[0] || plan?.steps?.[0]
            ? "Follow the steps above — some issues need manual fields (e.g. paste an ARN)"
            : "No automatic patch for this issue — use the guided fields"
        );
      } catch (err) {
        toastError(err.message || "Could not apply fix");
      } finally {
        setApplyingFindingId(null);
      }
    },
    [
      token,
      nodes,
      edges,
      pipelineMeta,
      userEmail,
      addIntegrityGateToGraph,
      updateNode,
      runDesignReviewScan,
      success,
      toastError,
    ]
  );

  const exportArchitectureDrawio = useCallback(() => {
    const meta = { ...pipelineMeta, ownerEmail: userEmail };
    const { xml } = generateDrawioArchitecture({
      topology: awsReview?.topology,
      nodes,
      pipelineMeta: meta,
    });
    const safe = (meta.name || "cognimesh").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
    downloadTextFile(`${safe}-architecture.drawio`, xml, "application/xml");
    success("Architecture diagram downloaded — open in diagrams.net");
  }, [awsReview?.topology, nodes, pipelineMeta, userEmail, success]);

  const exportInfrastructureTerraform = useCallback(() => {
    const meta = { ...pipelineMeta, ownerEmail: userEmail };
    const result = generatePipelineTerraform({ nodes, pipelineMeta: meta });
    if (result.status !== "success") {
      toastError(result.message || "No Terraform to export");
      return;
    }
    const safe = (meta.name || "cognimesh").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
    downloadTextFile(`${safe}-infrastructure.tf`, result.hcl, "text/plain");
    success(`Terraform exported (${result.provisionCount} RDS resource${result.provisionCount > 1 ? "s" : ""})`);
  }, [nodes, pipelineMeta, userEmail, success, toastError]);

  const selectedNode = nodesWithValidation.find((n) => n.id === selectedId) || null;

  const handlePreview = async () => {
    if (!nodes.length) {
      toastError("Load a pattern or add blocks first");
      return;
    }
    setPreviewLoading(true);
    setDeployError(null);
    setActiveDock("deploy");
    setActiveDock("deploy");
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const result = await previewPipeline({ nodes, edges, pipelineMeta: meta, token });
      if (result.status === "success") {
        setDeployResult({ ...result, status: "success", catalog: null });
        setDeployError(null);
        setHasPreviewed(true);
        success("Preview ready - review YAML before deploy");
        if (awsReview?.overall?.deployBlocked) {
          setFixWizardOpen(true);
        }
      } else {
        const errs = formatApiErrors(result);
        setDeployResult({ ...result, status: "error" });
        setDeployError(errs);
        setFixWizardOpen(true);
        toastError(errs[0] || "Preview failed — fix in wizard");
      }
    } catch (err) {
      setDeployError([err.message]);
      setFixWizardOpen(true);
      toastError(err.message || "API unavailable");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!nodes.length) {
      toastError("Load a pattern or add blocks first");
      return;
    }
    if (!blockValidation.valid) {
      setDeployError(blockValidation.errors);
      setFixWizardOpen(true);
      setActiveDock("deploy");
      setActiveDock("deploy");
      toastError(blockValidation.errors[0] || "Fix blocks before deploy");
      return;
    }
    if (awsReview?.overall?.deployBlocked) {
      setFixWizardOpen(true);
      toastError(`${awsReview.overall.criticalCount} critical issue(s) — use the fix wizard`);
      return;
    }
    setDeployImpact(null);
    setDeployImpactLoading(true);
    setShowDeployConfirm(true);
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const impact = await analyzeImpact(token, {
        nodes,
        edges,
        pipelineMeta: meta,
        changedColumns: [],
      });
      setDeployImpact(impact);
    } catch {
      setDeployImpact(null);
    } finally {
      setDeployImpactLoading(false);
    }
  };

  const handleVersionRollback = useCallback((data) => {
    if (data.nodes?.length) {
      setNodes(data.nodes);
      setEdges(data.edges || []);
      pushHistory(data.nodes, data.edges || []);
    }
    if (data.contract?.metadata) {
      setPipelineMeta((m) => ({
        ...m,
        name: data.contract.metadata.name || m.name,
        domain: data.contract.metadata.domain || m.domain,
        version: data.contract.metadata.version || m.version,
        awsRegion: data.contract.metadata.awsRegion || m.awsRegion,
      }));
    }
    success(data.message || "Rolled back to saved version");
  }, [setNodes, setEdges, pushHistory, success]);

  const handleAwsImport = useCallback((data) => {
    if (data.nodes?.length) {
      nodeIds.sync(data.nodes);
      setNodes(data.nodes);
      setEdges(data.edges || []);
      pushHistory(data.nodes, data.edges || []);
    }
    if (data.pipelineMeta) {
      setPipelineMeta((m) => ({ ...m, ...data.pipelineMeta }));
    }
    success(data.message || `Imported ${data.nodes?.length || 0} blocks from AWS`);
  }, [setNodes, setEdges, pushHistory, success]);

  const confirmDeploy = async () => {
    setShowDeployConfirm(false);
    setDeployLoading(true);
    setLoadingMessage("Deploying pipeline…");
    setDeployError(null);
    setActiveDock("deploy");
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const { ok, pendingApproval, data } = await deployPipeline({ nodes, edges, pipelineMeta: meta, token });
      if (pendingApproval) {
        setDeployResult({ status: "pending_approval", ...data });
        setDeployError(null);
        setCatalogRefresh((k) => k + 1);
        setActiveDock("approvals");
        success("Deploy submitted for steward approval");
      } else if (ok) {
        setDeployResult(data);
        setDeployError(null);
        setCatalogRefresh((k) => k + 1);
        setActiveDock("history");
        success(deploySuccessToast(data));
        if (data?.aws && !data.aws.deployed) {
          const msg =
            data.aws.error ||
            data.aws.reason ||
            "Pipeline compiled locally — Step Functions was not pushed to AWS.";
          toastError(
            data.aws.hint
              ? `${msg} (${data.aws.hint})`
              : msg
          );
        }
      } else {
        const errs = formatApiErrors(data);
        setDeployError(errs);
        setDeployResult(data.contract ? data : null);
        setActiveDock("deploy");
        setFixWizardOpen(true);
        toastError(errs[0] || "Deploy blocked — fix in wizard");
      }
    } catch (err) {
      setDeployError([err.message]);
      setFixWizardOpen(true);
      toastError(err.message || "Cannot reach API");
    } finally {
      setDeployLoading(false);
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
  }, [undo, redo, handlePreview]);

  return (
    <div className="app">
      <MobileWarning />
      <ToastStack toasts={toasts} />
      {deployLoading && <LoadingOverlay message={loadingMessage} />}

      <FixIssuesWizardModal
        open={fixWizardOpen}
        onClose={() => setFixWizardOpen(false)}
        findings={wizardFindings}
        nodes={nodes}
        edges={edges}
        pipelineMeta={{ ...pipelineMeta, ownerEmail: userEmail }}
        token={token}
        onFocusNode={focusCanvasNode}
        onApplyFindingFix={applyAwsFindingFix}
        onApplyNodeFix={updateNode}
        onApplyPipelineMeta={(patch) => setPipelineMeta((m) => ({ ...m, ...patch }))}
        applyingFindingId={applyingFindingId}
        title={
          deployError?.length
            ? `Fix deploy issue${deployError.length > 1 ? "s" : ""}`
            : awsReview?.overall?.criticalCount
              ? `Fix ${awsReview.overall.criticalCount} critical issue(s)`
              : "Fix pipeline issues"
        }
      />

      <WelcomeModal
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
        onApplyPattern={applyPattern}
      />

      <DeployConfirmModal
        open={showDeployConfirm}
        pipelineName={pipelineMeta.name}
        awsRegion={pipelineMeta.awsRegion || DEFAULT_AWS_REGION}
        onRegionChange={(awsRegion) => setPipelineMeta((m) => ({ ...m, awsRegion }))}
        awsReview={awsReview}
        awsDeployCheck={apiHealth?.checks?.aws_deploy}
        impact={deployImpact}
        impactLoading={deployImpactLoading}
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
          <HeaderDockMenu activeDock={activeDock} onSelect={toggleDock} onCloseAll={closeAllDocks} />
          <button
            className={`btn-secondary aws-review-header-btn ${awsReview?.overall?.deployBlocked ? "has-critical" : ""}`}
            type="button"
            onClick={() => setAwsReviewExpanded(true)}
          >
            AWS Review
            {awsReview?.overall?.criticalCount > 0 && (
              <span className="header-score score-bad">{awsReview.overall.criticalCount} critical</span>
            )}
            {awsReview?.overall?.score != null && !awsReview?.overall?.deployBlocked && (
              <span className="header-score score-ok">{awsReview.overall.score}</span>
            )}
          </button>
          {(awsReview?.overall?.criticalCount > 0 || awsReview?.overall?.deployBlocked) && (
            <button
              type="button"
              className="deploy-btn compact"
              data-testid="open-fix-wizard"
              onClick={() => setFixWizardOpen(true)}
            >
              Fix issues
            </button>
          )}
          <button className="btn-secondary" type="button" onClick={handlePreview} disabled={loading}>
            {previewLoading ? "Previewing…" : "Preview YAML"}
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
        <ErrorBoundary name="Agent Builder">
          <Suspense fallback={<PanelFallback />}>
            <AgentBuilderView
            userEmail={userEmail}
            authDisabled={authDisabled}
            onLogout={logout}
            token={token}
            bootstrap={agentBootstrap}
            onBootstrapApplied={() => setAgentBootstrap(null)}
            notify={{ success, error: toastError }}
          />
          </Suspense>
        </ErrorBoundary>
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

        <ErrorBoundary name="Canvas">
        <div className="canvas-column">
          {!tipDismissed && (
            <CanvasTipBar
              variant={tipVariant}
              onDismiss={tipVariant === "ready" ? () => setTipDismissed(true) : undefined}
            />
          )}

          <div
            className="canvas"
            ref={reactFlowWrapper}
            onDrop={nodes.length === 0 ? onDrop : undefined}
            onDragOver={nodes.length === 0 ? onDragOver : undefined}
          >
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

            {nodes.length > 0 && (
              <Suspense fallback={<PanelFallback />}>
                <PipelineFlow
                  nodes={nodesWithValidation}
                  edges={edges}
                  setNodes={setNodes}
                  setEdges={setEdges}
                  pushHistory={pushHistory}
                  reactFlowInstance={reactFlowInstance}
                  setSelectedId={setSelectedId}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                />
              </Suspense>
            )}

            <AwsDesignReviewHUD
              review={awsReview}
              reviewError={awsReviewError}
              loading={awsReviewLoading}
              expanded={awsReviewExpanded}
              onToggleExpand={() => setAwsReviewExpanded((v) => !v)}
              onFocusNode={focusCanvasNode}
              onRunReview={runDesignReviewScan}
              focusFindingId={awsFocusFindingId}
              autoLoadFixForId={awsAutoLoadFixForId}
              onFocusFindingHandled={() => setAwsFocusFindingId(null)}
              onAutoLoadFixHandled={() => setAwsAutoLoadFixForId(null)}
              onApplyNodeFix={(nodeId, patch) => {
                updateNode(nodeId, patch);
                success("Applied suggested fix — re-scanning AWS review…");
                setTimeout(runDesignReviewScan, 400);
              }}
              onApplyFindingFix={applyAwsFindingFix}
              applyingFindingId={applyingFindingId}
              onExportDrawio={exportArchitectureDrawio}
              onExportTerraform={exportInfrastructureTerraform}
              token={token}
              nodes={nodes}
              edges={edges}
              pipelineMeta={{ ...pipelineMeta, ownerEmail: userEmail }}
            />
          </div>
        </div>
        </ErrorBoundary>

        <ErrorBoundary name="Properties">
        <PropertiesPanel
          node={selectedNode}
          onChange={updateNode}
          pipelineMeta={pipelineMeta}
          onMetaChange={setPipelineMeta}
          awsFindings={selectedId ? awsReview?.findingsByNode?.[selectedId] : null}
          onOpenAwsReview={() => setAwsReviewExpanded(true)}
          onOpenAwsReviewFinding={(findingId) => {
            setAwsReviewExpanded(true);
            setAwsFocusFindingId(findingId);
            setAwsAutoLoadFixForId(findingId);
          }}
          onApplyFindingFix={applyAwsFindingFix}
          applyingFindingId={applyingFindingId}
          token={token}
          nodes={nodes}
          edges={edges}
        />
        </ErrorBoundary>

        {activeDock === "ops" && (
          <ErrorBoundary name="Operations">
          <Suspense fallback={<PanelFallback />}>
            <PlatformOperationsPanel
              key={`ops-${catalogRefresh}`}
              token={token}
              pipelineMeta={pipelineMeta}
              nodes={nodes}
              edges={edges}
              refreshKey={catalogRefresh}
              onRollback={handleVersionRollback}
              onImport={handleAwsImport}
              onClose={() => setActiveDock(null)}
            />
          </Suspense>
          </ErrorBoundary>
        )}

        {activeDock === "approvals" && (
          <ErrorBoundary name="Approvals">
          <Suspense fallback={<PanelFallback />}>
            <StewardApprovalsPanel
              token={token}
              refreshKey={catalogRefresh}
              onCatalogRefresh={() => setCatalogRefresh((k) => k + 1)}
            />
          </Suspense>
          </ErrorBoundary>
        )}

        {activeDock === "marketplace" && (
          <ErrorBoundary name="Marketplace">
          <Suspense fallback={<PanelFallback />}>
            <MarketplacePanel token={token} refreshKey={catalogRefresh} />
          </Suspense>
          </ErrorBoundary>
        )}

        {activeDock === "lineage" && (
          <ErrorBoundary name="Lineage">
          <Suspense fallback={<PanelFallback />}>
            <LineageCatalogPanel token={token} refreshKey={catalogRefresh} />
          </Suspense>
          </ErrorBoundary>
        )}

        {activeDock === "history" && (
          <ErrorBoundary name="Run History">
          <Suspense fallback={<PanelFallback />}>
            <ExecutionHistoryPanel
              token={token}
              pipelineName={pipelineMeta.name}
              domain={pipelineMeta.domain}
              refreshKey={catalogRefresh}
            />
          </Suspense>
          </ErrorBoundary>
        )}

        {activeDock === "deploy" && (
          <ErrorBoundary name="Deploy">
          <Suspense fallback={<PanelFallback />}>
            <DeployPanel
              result={deployResult}
              loading={previewLoading || deployLoading}
              loadingLabel={previewLoading ? "Generating contract preview…" : deployLoading ? "Deploying pipeline…" : undefined}
              error={deployError}
              token={token}
              onOpenFixWizard={() => setFixWizardOpen(true)}
            />
          </Suspense>
          </ErrorBoundary>
        )}
      </div>
      )}
    </div>
  );
}
