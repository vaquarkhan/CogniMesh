import { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import BlockPalette from "./components/BlockPalette";
import PipelineNode from "./components/PipelineNode";
import PropertiesPanel from "./components/PropertiesPanel";
import DeployPanel from "./components/DeployPanel";
import MarketplacePanel from "./components/MarketplacePanel";
import LineageCatalogPanel from "./components/LineageCatalogPanel";
import ExecutionHistoryPanel from "./components/ExecutionHistoryPanel";
import ToastStack, { useToast } from "./components/Toast";
import MobileWarning from "./components/MobileWarning";
import LoadingOverlay from "./components/LoadingOverlay";
import { deployPipeline, previewPipeline } from "./lib/api";
import { useAuth } from "./auth/AuthContext";

const nodeTypes = { pipeline: PipelineNode };

let nodeId = 0;
const nextId = () => `node-${++nodeId}`;

const initialNodes = [
  {
    id: "source-1",
    type: "pipeline",
    position: { x: 100, y: 160 },
    data: {
      label: "Source",
      blockType: "source",
      sourceType: "rds",
      database: "orders_db",
      table: "orders",
      cdcEnabled: true,
      primaryKey: "order_id",
      detail: "rds · CDC",
    },
  },
  {
    id: "transform-1",
    type: "pipeline",
    position: { x: 380, y: 160 },
    data: {
      label: "Transform",
      blockType: "transform",
      transformType: "spark_sql",
      executionMode: "batch",
      schedule: "0 */6 * * *",
      sparkSql: "SELECT order_id, customer_id, total_amount FROM bronze.orders",
      detail: "spark_sql",
    },
  },
  {
    id: "sink-1",
    type: "pipeline",
    position: { x: 660, y: 160 },
    data: {
      label: "Sink",
      blockType: "sink",
      targetType: "iceberg",
      location: "s3://cognimesh-dev-gold/portal-output/",
      catalogDatabase: "portal_gold",
      catalogTable: "orders",
      detail: "iceberg",
    },
  },
];

const initialEdges = [
  { id: "e1", source: "source-1", target: "transform-1", animated: true },
  { id: "e2", source: "transform-1", target: "sink-1", animated: true },
];

function snapshot(nodes, edges) {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

export default function App() {
  const { token, userEmail, logout, authDisabled } = useAuth();
  const { toasts, success, error: toastError } = useToast();
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [history, setHistory] = useState([snapshot(initialNodes, initialEdges)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [pipelineMeta, setPipelineMeta] = useState({
    name: "customer-orders-cdc",
    domain: "commerce",
    version: "1.0.0",
  });
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Working…");
  const [showDeploy, setShowDeploy] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(true);
  const [showLineageCatalog, setShowLineageCatalog] = useState(false);
  const [showExecutionHistory, setShowExecutionHistory] = useState(true);
  const [catalogRefresh, setCatalogRefresh] = useState(0);

  const selectedNode = nodes.find((n) => n.id === selectedId) || null;

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
      const existing = nodes.find((n) => n.data.blockType === blockType);
      if (existing && blockType !== "transform") {
        const msg = `Only one ${blockType} block is allowed.`;
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
        let next;
        if (blockType === "transform" && existing) {
          next = nds.map((n) => (n.id === existing.id ? newNode : n));
        } else {
          next = nds.concat(newNode);
        }
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

  const handlePreview = async () => {
    setLoading(true);
    setLoadingMessage("Generating contract preview…");
    setDeployError(null);
    setShowDeploy(true);
    try {
      const meta = { ...pipelineMeta, ownerEmail: userEmail };
      const result = await previewPipeline({ nodes, edges, pipelineMeta: meta, token });
      if (result.status === "success") {
        setDeployResult({ ...result, status: "success", catalog: null });
        success("Preview ready — review YAML before deploy");
      } else {
        const errs = result.errors || result.validation?.errors || ["Preview failed"];
        setDeployError(errs);
        toastError("Preview failed — check integrity gate");
      }
    } catch (err) {
      setDeployError([err.message]);
      toastError(err.message || "API unavailable");
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
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
        success("Pipeline deployed successfully");
      } else {
        const errs = data.errors || data.validation?.errors || data.integrityGate?.errors || ["Deploy failed"];
        setDeployError(errs);
        setDeployResult(data.contract ? data : null);
        toastError("Deploy blocked — see panel for details");
      }
    } catch (err) {
      setDeployError([err.message]);
      toastError(err.message || "Cannot reach API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <MobileWarning />
      <ToastStack toasts={toasts} />
      {loading && <LoadingOverlay message={loadingMessage} />}

      <header className="header">
        <div>
          <h1>CogniMesh</h1>
          <p className="subtitle">Zero-code pipeline designer</p>
        </div>
        <div className="header-actions">
          {!authDisabled && userEmail && <span className="user-badge">{userEmail}</span>}
          <button className="btn-secondary" type="button" onClick={undo} disabled={historyIndex <= 0}>
            Undo
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
          >
            Redo
          </button>
          <button className="btn-secondary" type="button" onClick={() => setShowExecutionHistory((v) => !v)}>
            Run History
          </button>
          <button className="btn-secondary" type="button" onClick={() => setShowLineageCatalog((v) => !v)}>
            Lineage Catalog
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
      </header>

      <div className="main">
        <BlockPalette />

        <div className="canvas" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
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
                const c = { source: "#059669", transform: "#2563eb", sink: "#ea580c" };
                return c[n.data?.blockType] || "#6b7280";
              }}
            />
          </ReactFlow>
        </div>

        <PropertiesPanel
          node={selectedNode}
          onChange={updateNode}
          pipelineMeta={pipelineMeta}
          onMetaChange={setPipelineMeta}
        />

        {showMarketplace && <MarketplacePanel token={token} refreshKey={catalogRefresh} />}

        {showLineageCatalog && (
          <LineageCatalogPanel token={token} refreshKey={catalogRefresh} />
        )}

        {showExecutionHistory && (
          <ExecutionHistoryPanel
            token={token}
            pipelineName={pipelineMeta.name}
            domain={pipelineMeta.domain}
            refreshKey={catalogRefresh}
          />
        )}

        {showDeploy && (
          <DeployPanel result={deployResult} loading={loading} error={deployError} />
        )}
      </div>
    </div>
  );
}
