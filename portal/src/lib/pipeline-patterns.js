/**
 * Pre-built pipeline patterns — users pick one, then customize blocks & properties.
 * Each pattern includes nodes, edges, metadata, and guided tips.
 */

import { EXTRA_PATTERNS } from "./patterns/extra-patterns";
export { ARCHITECTURE_LABELS } from "./patterns/helpers";

export const PATTERN_CATEGORIES = [
  "Medallion",
  "Structured",
  "Finance",
  "Healthcare",
  "Retail",
  "Cognitive",
  "Analytics",
  "Streaming",
  "Compliance",
];

const CORE_PATTERNS = [
  {
    id: "multi-source-mesh",
    name: "Multi-Source → Parallel → Choice",
    subtitle: "Step Functions workflow · many sources & sinks",
    category: "Structured",
    architecture: "workflow",
    medallionLayers: ["bronze", "silver", "gold"],
    difficulty: "Intermediate",
    badge: "Workflow",
    icon: "🔀",
    description:
      "Ingest from RDS and S3 in parallel, merge, then route to Iceberg gold or S3 archive based on a Choice state — like AWS Step Functions.",
    whenToUse: "Multiple upstream systems feeding one mesh product with conditional routing.",
    exampleScenario: "RDS orders + S3 partner files run in parallel, merge, route high-value orders to gold Iceberg and others to archive.",
    exampleFlow: "Start → Parallel(RDS, S3) → Merge → Integrity Gate → Choice → Gold | Archive",
    architectureDiagram: "Parallel ingest → Merge → PVDM Gate → Choice routing",
    awsServices: ["RDS", "S3", "Glue", "Step Functions", "Lambda"],
    pipelineMeta: {
      name: "multi-source-mesh",
      domain: "commerce",
      version: "1.0.0",
    },
    nodes: [
      {
        id: "start-1",
        type: "pipeline",
        position: { x: 40, y: 200 },
        data: { label: "Start", blockType: "start", detail: "Entry point" },
      },
      {
        id: "parallel-1",
        type: "pipeline",
        position: { x: 180, y: 200 },
        data: { label: "Parallel", blockType: "parallel", branchCount: 2, detail: "2 branches" },
      },
      {
        id: "source-rds",
        type: "pipeline",
        position: { x: 380, y: 80 },
        data: {
          label: "RDS Orders",
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
        id: "source-s3",
        type: "pipeline",
        position: { x: 380, y: 320 },
        data: {
          label: "S3 Partner Files",
          blockType: "source",
          sourceType: "s3",
          endpoint: "s3://cognimesh-landing/partner/",
          detail: "s3 · batch",
        },
      },
      {
        id: "transform-rds",
        type: "pipeline",
        position: { x: 580, y: 80 },
        data: {
          label: "Orders SQL",
          blockType: "transform",
          transformType: "spark_sql",
          executionMode: "batch",
          schedule: "0 */6 * * *",
          sparkSql: "SELECT order_id, customer_id, total FROM bronze.orders",
          detail: "spark_sql",
        },
      },
      {
        id: "transform-s3",
        type: "pipeline",
        position: { x: 580, y: 320 },
        data: {
          label: "File Cleanse",
          blockType: "transform",
          transformType: "spark_sql",
          executionMode: "batch",
          schedule: "0 2 * * *",
          sparkSql: "SELECT *, current_timestamp() AS loaded_at FROM bronze.partner_files",
          detail: "spark_sql",
        },
      },
      {
        id: "merge-1",
        type: "pipeline",
        position: { x: 780, y: 200 },
        data: { label: "Merge", blockType: "merge", detail: "Join branches" },
      },
      {
        id: "gate-1",
        type: "pipeline",
        position: { x: 940, y: 200 },
        data: { label: "Integrity Gate", blockType: "integrity_gate", detail: "Vaquar PVDM" },
      },
      {
        id: "choice-1",
        type: "pipeline",
        position: { x: 1100, y: 200 },
        data: { label: "Route by tier", blockType: "choice", defaultRoute: "archive", detail: "gold | archive" },
      },
      {
        id: "sink-gold",
        type: "pipeline",
        position: { x: 1320, y: 100 },
        data: {
          label: "Iceberg Gold",
          blockType: "sink",
          targetType: "iceberg",
          location: "s3://cognimesh-commerce-gold/unified/",
          catalogDatabase: "commerce_gold",
          catalogTable: "unified_orders",
          detail: "iceberg · gold",
        },
      },
      {
        id: "sink-archive",
        type: "pipeline",
        position: { x: 1320, y: 300 },
        data: {
          label: "S3 Archive",
          blockType: "sink",
          targetType: "s3",
          location: "s3://cognimesh-archive/commerce/",
          detail: "s3 · archive",
        },
      },
    ],
    edges: [
      { id: "e0", source: "start-1", target: "parallel-1", animated: true },
      { id: "e1", source: "parallel-1", target: "source-rds", animated: true },
      { id: "e2", source: "parallel-1", target: "source-s3", animated: true },
      { id: "e3", source: "source-rds", target: "transform-rds", animated: true },
      { id: "e4", source: "source-s3", target: "transform-s3", animated: true },
      { id: "e5", source: "transform-rds", target: "merge-1", animated: true },
      { id: "e6", source: "transform-s3", target: "merge-1", animated: true },
      { id: "e7", source: "merge-1", target: "gate-1", animated: true },
      { id: "e8", source: "gate-1", target: "choice-1", animated: true },
      { id: "e9", source: "choice-1", target: "sink-gold", label: "gold", animated: true },
      { id: "e10", source: "choice-1", target: "sink-archive", label: "archive", animated: true },
    ],
    customizeTips: [
      "This is a Step Functions–style graph: Start → Parallel → Merge → Choice.",
      "Add more Source blocks and wire them into Parallel branches.",
      "Click Choice → connect each route to a different Sink.",
      "Preview YAML to see the generated state machine ASL.",
    ],
  },
  {
    id: "vaquar-cdc-orders",
    name: "RDS CDC → Iceberg",
    subtitle: "Vaquar PVDM · proof-gated writes",
    category: "Structured",
    architecture: "medallion",
    medallionLayers: ["bronze", "silver", "gold"],
    difficulty: "Beginner",
    badge: "Recommended",
    icon: "📊",
    description:
      "Capture changes from Amazon RDS (MySQL) into a Bronze → Silver → Gold medallion, with Vaquar PVDM verification before Iceberg commit.",
    whenToUse: "Operational databases that need reliable CDC into the data mesh.",
    exampleScenario: "Shopify-style orders table with order_id PK → hourly CDC → gold orders Iceberg table for analytics.",
    exampleFlow: "RDS CDC → Spark SQL (silver cleanse) → PVDM VRP proof → Iceberg gold",
    architectureDiagram: "RDS ──▶ Bronze ──▶ Silver SQL ──▶ Gold Iceberg (VRP gated)",
    awsServices: ["RDS", "Glue", "S3", "Step Functions", "Lambda"],
    pipelineMeta: {
      name: "customer-orders-cdc",
      domain: "commerce",
      version: "1.0.0",
    },
    nodes: [
      {
        id: "source-1",
        type: "pipeline",
        position: { x: 80, y: 140 },
        data: {
          label: "RDS Orders",
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
        position: { x: 360, y: 140 },
        data: {
          label: "Spark SQL",
          blockType: "transform",
          transformType: "spark_sql",
          executionMode: "batch",
          schedule: "0 */6 * * *",
          sparkSql:
            "SELECT order_id, customer_id, total_amount, created_at\nFROM bronze.orders\nWHERE created_at >= '${execution_date}'",
          sparkRulesEnabled: true,
          qualityPolicyId: "strict-zero-drop",
          pvdmContentFields: "order_id, customer_id, total_amount, created_at",
          maxNullPct: 100,
          detail: "spark_sql · Vaquar · DQ",
        },
      },
      {
        id: "sink-1",
        type: "pipeline",
        position: { x: 640, y: 140 },
        data: {
          label: "Iceberg Gold",
          blockType: "sink",
          targetType: "iceberg",
          location: "s3://cognimesh-commerce-gold/orders/",
          catalogDatabase: "commerce_gold",
          catalogTable: "orders",
          detail: "iceberg · gold",
        },
      },
    ],
    edges: [
      { id: "e1", source: "source-1", target: "transform-1", animated: true },
      { id: "e2", source: "transform-1", target: "sink-1", animated: true },
    ],
    customizeTips: [
      "Click the green Source block → set your database and table names.",
      "Click the blue Transform block → edit Spark SQL for your columns.",
      "Click the orange Sink block → set your S3 path and Glue catalog table.",
      "Use Preview YAML before Deploy to review the generated contract.",
    ],
  },
  {
    id: "cognitive-media",
    name: "Media → AI Enrichment",
    subtitle: "Bedrock agent · EKS runtime",
    category: "Cognitive",
    difficulty: "Intermediate",
    badge: "AI",
    icon: "🤖",
    description:
      "Ingest media URLs, run an agentic Bedrock transform, and write structured Parquet to Iceberg with compensation on failure.",
    whenToUse: "Unstructured media, transcripts, or multimodal content needing AI extraction.",
    awsServices: ["S3", "Bedrock", "EKS", "Step Functions"],
    pipelineMeta: {
      name: "media-transcript-enrichment",
      domain: "media-intelligence",
      version: "1.0.0",
    },
    nodes: [
      {
        id: "source-1",
        type: "pipeline",
        position: { x: 80, y: 140 },
        data: {
          label: "Media Ingest",
          blockType: "source",
          sourceType: "media_url",
          endpoint: "s3://cognimesh-media-ingest/raw/",
          detail: "media_url",
        },
      },
      {
        id: "transform-1",
        type: "pipeline",
        position: { x: 360, y: 140 },
        data: {
          label: "Bedrock Agent",
          blockType: "transform",
          transformType: "agentic",
          executionMode: "stream",
          modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
          promptTemplate:
            "Extract structured entities from the provided media.\nReturn JSON: title, summary, entities[], sentiment.",
          compensationHandler: "cognimesh.compensation.media-rollback",
          detail: "agentic · Bedrock",
        },
      },
      {
        id: "sink-1",
        type: "pipeline",
        position: { x: 640, y: 140 },
        data: {
          label: "Iceberg Transcripts",
          blockType: "sink",
          targetType: "iceberg",
          location: "s3://cognimesh-media-gold/transcripts/",
          catalogDatabase: "media_gold",
          catalogTable: "enriched_transcripts",
          detail: "iceberg · gold",
        },
      },
    ],
    edges: [
      { id: "e1", source: "source-1", target: "transform-1", animated: true },
      { id: "e2", source: "transform-1", target: "sink-1", animated: true },
    ],
    customizeTips: [
      "Set the S3 ingest path where raw media files land.",
      "Tune the prompt template for the fields you need extracted.",
      "Compensation handler enables rollback if the agent fails mid-run.",
    ],
  },
  {
    id: "s3-batch-lake",
    name: "S3 Files → Iceberg",
    subtitle: "Batch file landing zone",
    category: "Analytics",
    difficulty: "Beginner",
    icon: "📁",
    description: "Land CSV/JSON files from S3, apply Spark SQL cleansing, register as an Iceberg table.",
    whenToUse: "File drops, partner feeds, or batch exports without CDC.",
    awsServices: ["S3", "Glue", "Step Functions"],
    pipelineMeta: {
      name: "partner-files-batch",
      domain: "analytics",
      version: "1.0.0",
    },
    nodes: [
      {
        id: "source-1",
        type: "pipeline",
        position: { x: 80, y: 140 },
        data: {
          label: "S3 Landing",
          blockType: "source",
          sourceType: "s3",
          endpoint: "s3://cognimesh-landing/partner/",
          detail: "s3 · batch",
        },
      },
      {
        id: "transform-1",
        type: "pipeline",
        position: { x: 360, y: 140 },
        data: {
          label: "Cleanse & Type",
          blockType: "transform",
          transformType: "spark_sql",
          executionMode: "batch",
          schedule: "0 2 * * *",
          sparkSql: "SELECT *, current_timestamp() AS loaded_at FROM bronze.raw_files",
          detail: "spark_sql",
        },
      },
      {
        id: "sink-1",
        type: "pipeline",
        position: { x: 640, y: 140 },
        data: {
          label: "Iceberg Silver",
          blockType: "sink",
          targetType: "iceberg",
          location: "s3://cognimesh-analytics-silver/partner/",
          catalogDatabase: "analytics_silver",
          catalogTable: "partner_files",
          detail: "iceberg · silver",
        },
      },
    ],
    edges: [
      { id: "e1", source: "source-1", target: "transform-1", animated: true },
      { id: "e2", source: "transform-1", target: "sink-1", animated: true },
    ],
    customizeTips: [
      "Point Source endpoint to your landing bucket prefix.",
      "Adjust Spark SQL for column typing and null handling.",
    ],
  },
  {
    id: "kafka-stream",
    name: "Kafka → Iceberg Stream",
    subtitle: "Real-time event pipeline",
    category: "Streaming",
    difficulty: "Advanced",
    icon: "⚡",
    description: "Stream events from Kafka through a passthrough or Spark transform into Iceberg.",
    whenToUse: "Clickstream, IoT, or event bus data with low latency requirements.",
    awsServices: ["MSK/Kafka", "Glue", "S3", "Step Functions"],
    pipelineMeta: {
      name: "events-stream",
      domain: "events",
      version: "1.0.0",
    },
    nodes: [
      {
        id: "source-1",
        type: "pipeline",
        position: { x: 80, y: 140 },
        data: {
          label: "Kafka Topic",
          blockType: "source",
          sourceType: "kafka",
          endpoint: "events.raw",
          detail: "kafka · stream",
        },
      },
      {
        id: "transform-1",
        type: "pipeline",
        position: { x: 360, y: 140 },
        data: {
          label: "Event Parse",
          blockType: "transform",
          transformType: "passthrough",
          executionMode: "stream",
          sparkSql: "SELECT event_id, payload, event_time FROM source",
          detail: "passthrough",
        },
      },
      {
        id: "sink-1",
        type: "pipeline",
        position: { x: 640, y: 140 },
        data: {
          label: "Iceberg Events",
          blockType: "sink",
          targetType: "iceberg",
          location: "s3://cognimesh-events-gold/stream/",
          catalogDatabase: "events_gold",
          catalogTable: "raw_events",
          detail: "iceberg",
        },
      },
    ],
    edges: [
      { id: "e1", source: "source-1", target: "transform-1", animated: true },
      { id: "e2", source: "transform-1", target: "sink-1", animated: true },
    ],
    customizeTips: [
      "Set Kafka topic name in Source endpoint field.",
      "Use stream execution mode for continuous processing.",
    ],
  },
  {
    id: "mysql-redshift",
    name: "MySQL → Redshift",
    subtitle: "Warehouse sync",
    category: "Analytics",
    difficulty: "Intermediate",
    icon: "🏢",
    description: "Extract from MySQL, transform in Spark SQL, load into Redshift for BI dashboards.",
    whenToUse: "Reporting workloads that need a columnar warehouse copy of OLTP data.",
    awsServices: ["RDS", "Glue", "Redshift", "S3"],
    pipelineMeta: {
      name: "mysql-redshift-sync",
      domain: "reporting",
      version: "1.0.0",
    },
    nodes: [
      {
        id: "source-1",
        type: "pipeline",
        position: { x: 80, y: 140 },
        data: {
          label: "MySQL",
          blockType: "source",
          sourceType: "mysql",
          database: "app_db",
          table: "customers",
          cdcEnabled: false,
          detail: "mysql · batch",
        },
      },
      {
        id: "transform-1",
        type: "pipeline",
        position: { x: 360, y: 140 },
        data: {
          label: "Denormalize",
          blockType: "transform",
          transformType: "spark_sql",
          executionMode: "batch",
          schedule: "0 4 * * *",
          sparkSql: "SELECT id, name, email, updated_at FROM bronze.customers",
          detail: "spark_sql",
        },
      },
      {
        id: "sink-1",
        type: "pipeline",
        position: { x: 640, y: 140 },
        data: {
          label: "Redshift",
          blockType: "sink",
          targetType: "redshift",
          location: "s3://cognimesh-staging/redshift/customers/",
          catalogDatabase: "reporting",
          catalogTable: "dim_customers",
          detail: "redshift",
        },
      },
    ],
    edges: [
      { id: "e1", source: "source-1", target: "transform-1", animated: true },
      { id: "e2", source: "transform-1", target: "sink-1", animated: true },
    ],
    customizeTips: [
      "Provide MySQL database and table in Source properties.",
      "Set Redshift staging S3 path before deploy.",
    ],
  },
  {
    id: "blank",
    name: "Blank canvas",
    subtitle: "Build from scratch",
    category: "Structured",
    difficulty: "Advanced",
    icon: "✨",
    description: "Empty canvas — drag Source, Transform, and Sink blocks yourself.",
    whenToUse: "You already know the topology or need a custom layout.",
    awsServices: [],
    pipelineMeta: {
      name: "my-pipeline",
      domain: "my-domain",
      version: "1.0.0",
    },
    nodes: [],
    edges: [],
    customizeTips: [
      "Drag Flow blocks (Start, Parallel, Choice, Merge) from the Blocks tab.",
      "Add multiple Sources, Transforms, and Sinks — no limit.",
      "Connect branches like AWS Step Functions.",
    ],
  },
];

export const PIPELINE_PATTERNS = [...CORE_PATTERNS, ...EXTRA_PATTERNS];

export const WORKFLOW_STEPS = [
  {
    id: "pick",
    title: "Pick a pattern",
    detail: "Choose a pre-built template from the Pattern Library, or start blank.",
  },
  {
    id: "customize",
    title: "Customize blocks",
    detail: "Click blocks on the canvas. Edit names, SQL, S3 paths in the Properties panel.",
  },
  {
    id: "connect",
    title: "Connect & validate",
    detail: "Wire Start → Parallel branches → Merge → Choice routes. Red borders show what to fix.",
  },
  {
    id: "preview",
    title: "Preview YAML",
    detail: "Review the generated DataContract before anything is deployed.",
  },
  {
    id: "deploy",
    title: "Deploy",
    detail: "Register in the marketplace and optionally push to AWS.",
  },
];

/**
 * Clone a pattern with fresh node IDs for React Flow.
 */
export function instantiatePattern(pattern) {
  const idMap = {};
  let seq = 0;
  const nodes = pattern.nodes.map((n) => {
    const newId = `node-${++seq}`;
    idMap[n.id] = newId;
    return {
      ...n,
      id: newId,
      data: { ...n.data },
      position: { ...n.position },
    };
  });
  const edges = pattern.edges.map((e, i) => ({
    id: `e-${i + 1}`,
    source: idMap[e.source],
    target: idMap[e.target],
    animated: true,
  }));
  return {
    nodes,
    edges,
    pipelineMeta: { ...pattern.pipelineMeta },
    patternId: pattern.id,
    tips: pattern.customizeTips || [],
  };
}

export function getPatternById(id) {
  return PIPELINE_PATTERNS.find((p) => p.id === id);
}
