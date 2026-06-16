/**
 * Data architecture pattern catalog - Mesh, Lake, Lakehouse, Kappa, Lambda, Streaming.
 * Each pattern is a full multi-block canvas graph with AWS services labeled on nodes.
 */
import { medallionPattern } from "./helpers";
import { meshAccountsForPipelineMeta, withMeshContext, withMeshRole } from "./mesh-constants";

function wf(nodes, edges, meta, extra = {}) {
  return { nodes, edges, pipelineMeta: meta, ...extra };
}

export const ARCHITECTURE_PATTERNS = [
  // ── DATA MESH ─────────────────────────────────────────────────
  {
    id: "arch-datamesh-domain-product",
    name: "Data Mesh - Domain Data Product",
    subtitle: "Self-serve · Lake Formation · marketplace publish",
    category: "Data Mesh",
    architecture: "datamesh",
    architectureTags: ["datamesh", "lakehouse", "medallion"],
    difficulty: "Advanced",
    badge: "Data Mesh",
    icon: "🕸",
    description:
      "Domain team owns end-to-end pipeline: ingest → bronze → silver → gold Iceberg product → integrity gate → catalog registration → Lake Formation share to consumers.",
    whenToUse: "Federated data mesh where each domain publishes a versioned data product with contracts and SLAs.",
    exampleScenario: "Commerce domain publishes orders_daily v1.0 - analysts request access via marketplace, stewards grant LF SELECT.",
    exampleFlow: "RDS CDC → Bronze → Silver ETL → Gold Iceberg → PVDM Gate → Glue Catalog → LF Tag → Marketplace",
    architectureDiagram:
      "Producer AC → Bronze → Silver → Gold\nSteward AC → PVDM Gate (VRP)\nPublisher AC → Iceberg product → LF → Marketplace",
    diagramReference: "https://docs.aws.amazon.com/whitepapers/latest/building-data-mesh-on-aws/data-mesh-patterns.html",
    ...wf(
      [
        { id: "st", type: "pipeline", position: { x: 40, y: 200 }, data: { label: "Start", blockType: "start", detail: "Domain pipeline" } },
        {
          id: "src",
          type: "pipeline",
          position: { x: 180, y: 200 },
          data: withMeshRole(
            {
              label: "RDS Orders",
              blockType: "source",
              sourceType: "rds",
              awsService: "rds",
              database: "commerce",
              table: "orders",
              cdcEnabled: true,
              primaryKey: "order_id",
              meshDomain: "commerce",
            },
            "producer"
          ),
        },
        {
          id: "bronze",
          type: "pipeline",
          position: { x: 400, y: 200 },
          data: withMeshRole(
            { label: "Bronze Landing", blockType: "transform", transformType: "glue_etl", awsService: "glue", processingMode: "elt", executionMode: "batch", schedule: "0 */4 * * *", sparkSql: "SELECT *, _cdc_ts FROM bronze.orders_raw", meshDomain: "commerce" },
            "producer"
          ),
        },
        {
          id: "silver",
          type: "pipeline",
          position: { x: 620, y: 200 },
          data: withMeshRole(
            { label: "Silver Conform", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "etl", executionMode: "batch", sparkSql: "SELECT order_id, customer_id, CAST(total AS decimal(18,2)) total FROM bronze.orders WHERE order_id IS NOT NULL", meshDomain: "commerce" },
            "producer"
          ),
        },
        {
          id: "gold",
          type: "pipeline",
          position: { x: 840, y: 200 },
          data: withMeshRole(
            { label: "Gold Product", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "aggregate", sparkSql: "SELECT DATE(created_at) dt, SUM(total) revenue FROM silver.orders GROUP BY 1", meshDomain: "commerce" },
            "producer"
          ),
        },
        {
          id: "gate",
          type: "pipeline",
          position: { x: 1060, y: 200 },
          data: withMeshRole({ label: "PVDM Gate", blockType: "integrity_gate", awsService: "lambda", meshDomain: "commerce" }, "steward"),
        },
        {
          id: "sink",
          type: "pipeline",
          position: { x: 1280, y: 200 },
          data: withMeshRole(
            {
              label: "Iceberg Product",
              blockType: "sink",
              targetType: "iceberg",
              awsService: "iceberg",
              location: "s3://mesh-commerce-gold/orders_daily/",
              catalogDatabase: "commerce_gold",
              catalogTable: "orders_daily",
              meshDomain: "commerce",
            },
            "publisher"
          ),
        },
      ],
      [
        { id: "e1", source: "st", target: "src" },
        { id: "e2", source: "src", target: "bronze" },
        { id: "e3", source: "bronze", target: "silver" },
        { id: "e4", source: "silver", target: "gold" },
        { id: "e5", source: "gold", target: "gate" },
        { id: "e6", source: "gate", target: "sink" },
      ],
      meshAccountsForPipelineMeta({ name: "orders-daily-product", domain: "commerce", version: "1.0.0", schemaEvolutionPolicy: "compatible" })
    ),
    customizeTips: [
      "Producer AC runs ingest → gold transforms.",
      "Steward AC hosts PVDM / VRP integrity gate.",
      "Publisher AC registers Iceberg product + Lake Formation share.",
    ],
  },
  {
    id: "arch-datamesh-multi-domain",
    name: "Data Mesh - Multi-Domain Parallel",
    subtitle: "3 domain ACs → merge → federated gold",
    category: "Data Mesh",
    architecture: "datamesh",
    architectureTags: ["datamesh", "workflow"],
    difficulty: "Expert",
    badge: "Multi-Domain",
    icon: "🕸",
    description:
      "Three domain pipelines run in parallel (orders, inventory, customers) - each in its own producer AWS account and region - merge into a federated customer-360 gold product in the publisher account.",
    whenToUse: "Cross-domain analytics product built from multiple domain-owned pipelines without central ETL team bottleneck.",
    exampleScenario: "Retail mesh: orders (commerce AC) + inventory (supply AC) + customers (CRM AC) parallel ingest, merge on customer_id, publish 360 view to publisher AC.",
    exampleFlow: "Start → Parallel(orders|inventory|customers) → Merge → Enrichment → Steward Gate → Publisher Gold",
    architectureDiagram:
      "AC-1111 orders/us-east-1 ──┐\nAC-2222 inventory/us-west-2 ─┼→ Merge → Enrich → Gate → AC-3456 gold\nAC-3333 customers/eu-west-1 ──┘",
    diagramReference: "https://github.com/vaquarkhan/aws-serverless-datamesh-framework/blob/main/docs/vaquar-pattern.md",
    nodes: [
      { id: "st", type: "pipeline", position: { x: 40, y: 220 }, data: { label: "Start", blockType: "start", detail: "Federated mesh" } },
      { id: "par", type: "pipeline", position: { x: 160, y: 220 }, data: { label: "Parallel", blockType: "parallel", branchCount: 3, detail: "3 domain ACs" } },
      {
        id: "s1",
        type: "pipeline",
        position: { x: 360, y: 60 },
        data: withMeshContext(
          { label: "Commerce RDS", blockType: "source", sourceType: "rds", awsService: "rds", database: "commerce", table: "orders", cdcEnabled: true, primaryKey: "order_id" },
          "orders"
        ),
      },
      {
        id: "t1",
        type: "pipeline",
        position: { x: 560, y: 60 },
        data: withMeshContext(
          { label: "Orders ETL", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "etl", sparkSql: "SELECT customer_id, order_id, total FROM bronze.orders" },
          "orders"
        ),
      },
      {
        id: "s2",
        type: "pipeline",
        position: { x: 360, y: 220 },
        data: withMeshContext(
          { label: "Inventory Kafka", blockType: "source", sourceType: "kafka", awsService: "msk", endpoint: "inventory.updates" },
          "inventory"
        ),
      },
      {
        id: "t2",
        type: "pipeline",
        position: { x: 560, y: 220 },
        data: withMeshContext(
          { label: "Stock Stream", blockType: "transform", transformType: "glue_etl", awsService: "glue", processingMode: "stream_window", executionMode: "stream", sparkSql: "SELECT sku, qty, window FROM stream.inventory" },
          "inventory"
        ),
      },
      {
        id: "s3",
        type: "pipeline",
        position: { x: 360, y: 380 },
        data: withMeshContext(
          { label: "CRM S3", blockType: "source", sourceType: "s3", awsService: "s3", endpoint: "s3://crm-landing/contacts/" },
          "customers"
        ),
      },
      {
        id: "t3",
        type: "pipeline",
        position: { x: 560, y: 380 },
        data: withMeshContext(
          { label: "CRM ELT", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "elt", sparkSql: "SELECT customer_id, segment, region FROM bronze.crm" },
          "customers"
        ),
      },
      { id: "mg", type: "pipeline", position: { x: 780, y: 220 }, data: withMeshRole({ label: "Merge", blockType: "merge", meshDomain: "federated" }, "publisher", "us-east-1") },
      {
        id: "en",
        type: "pipeline",
        position: { x: 980, y: 220 },
        data: withMeshRole(
          { label: "Customer 360", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "enrichment", sparkSql: "SELECT o.customer_id, o.total, i.qty, c.segment FROM orders o JOIN inventory i JOIN crm c", meshDomain: "federated" },
          "publisher",
          "us-east-1"
        ),
      },
      { id: "gt", type: "pipeline", position: { x: 1180, y: 220 }, data: withMeshRole({ label: "Mesh Gate", blockType: "integrity_gate", awsService: "lambda", meshDomain: "federated" }, "steward", "us-east-1") },
      {
        id: "sk",
        type: "pipeline",
        position: { x: 1380, y: 220 },
        data: withMeshRole(
          { label: "360 Gold", blockType: "sink", targetType: "iceberg", awsService: "iceberg", location: "s3://mesh-federated/customer_360/", catalogDatabase: "federated_gold", catalogTable: "customer_360", meshDomain: "federated" },
          "publisher",
          "us-east-1"
        ),
      },
    ],
    edges: [
      { id: "e1", source: "st", target: "par" },
      { id: "e2", source: "par", target: "s1", sourceHandle: "b1" },
      { id: "e3", source: "s1", target: "t1" },
      { id: "e4", source: "t1", target: "mg" },
      { id: "e5", source: "par", target: "s2", sourceHandle: "b2" },
      { id: "e6", source: "s2", target: "t2" },
      { id: "e7", source: "t2", target: "mg" },
      { id: "e8", source: "par", target: "s3", sourceHandle: "b3" },
      { id: "e9", source: "s3", target: "t3" },
      { id: "e10", source: "t3", target: "mg" },
      { id: "e11", source: "mg", target: "en" },
      { id: "e12", source: "en", target: "gt" },
      { id: "e13", source: "gt", target: "sk" },
    ],
    pipelineMeta: meshAccountsForPipelineMeta({ name: "customer-360-mesh", domain: "federated", version: "1.0.0", meshLayout: "three-domain-parallel" }),
    customizeTips: [
      "Each parallel branch = one domain producer AC + region (orders · inventory · customers).",
      "Merge / enrich / gold sink run in publisher AC - steward AC hosts VRP gate.",
      "Matches Vaquar SDM mesh accounts: producer / steward / publisher.",
    ],
  },

  // ── DATA LAKE ─────────────────────────────────────────────────
  {
    id: "arch-datalake-zones",
    name: "Data Lake - Raw / Curated / Consumption Zones",
    subtitle: "Schema-on-read · S3 zones · Glue crawler",
    category: "Data Lake",
    architecture: "datalake",
    architectureTags: ["datalake", "medallion"],
    difficulty: "Intermediate",
    badge: "Data Lake",
    icon: "🏞",
    description: "Classic data lake: land everything raw (raw zone), curate with Glue ETL (curated zone), expose for Athena (consumption). No Iceberg required - Parquet on S3.",
    whenToUse: "Exploratory analytics, data science sandboxes, or pre-lakehouse migration path.",
    exampleScenario: "IoT sensors + app logs land raw, daily Glue job curates Parquet, analysts query via Athena external tables.",
    exampleFlow: "S3 raw → Glue Crawler → ELT bronze → ETL curated Parquet → Athena view",
    architectureDiagram: "S3 raw/ → Glue ETL → S3 curated/ → Athena\n         ↘ Crawler → Glue Catalog",
    awsServices: ["S3", "Glue", "Athena", "Lake Formation"],
    nodes: [
      { id: "src", type: "pipeline", position: { x: 80, y: 180 }, data: { label: "S3 Raw Landing", blockType: "source", sourceType: "s3", awsService: "s3", endpoint: "s3://datalake-raw/events/", detail: "🪣 raw zone" } },
      { id: "crawl", type: "pipeline", position: { x: 300, y: 180 }, data: { label: "Glue Crawler", blockType: "transform", transformType: "glue_etl", awsService: "glue", processingMode: "elt", sparkSql: "-- Glue Crawler infers schema\nSELECT * FROM raw.events", detail: "🧊 Crawler · schema-on-read" } },
      { id: "cur", type: "pipeline", position: { x: 520, y: 180 }, data: { label: "Curated ETL", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "etl", sparkSql: "SELECT event_id, event_type, CAST(ts AS timestamp) ts FROM raw.events WHERE event_id IS NOT NULL", detail: "🧊 ETL curated" } },
      { id: "gate", type: "pipeline", position: { x: 740, y: 180 }, data: { label: "Quality Gate", blockType: "integrity_gate", awsService: "lambda" } },
      { id: "sink", type: "pipeline", position: { x: 960, y: 180 }, data: { label: "Curated Parquet", blockType: "sink", targetType: "s3", awsService: "s3", location: "s3://datalake-curated/events/", detail: "🪣 curated zone" } },
      { id: "ath", type: "pipeline", position: { x: 960, y: 320 }, data: { label: "Athena View", blockType: "sink", targetType: "s3", awsService: "athena", location: "s3://datalake-curated/athena/", catalogDatabase: "datalake_curated", catalogTable: "events_v", detail: "🔍 Athena consumption" } },
    ],
    edges: [
      { id: "e1", source: "src", target: "crawl" },
      { id: "e2", source: "crawl", target: "cur" },
      { id: "e3", source: "cur", target: "gate" },
      { id: "e4", source: "gate", target: "sink" },
      { id: "e5", source: "sink", target: "ath" },
    ],
    pipelineMeta: { name: "datalake-events", domain: "platform", version: "1.0.0" },
    customizeTips: ["Raw zone = immutable landing.", "Curated = typed Parquet partitions.", "Add LF when sharing cross-team."],
  },

  // ── LAKEHOUSE ─────────────────────────────────────────────────
  {
    id: "arch-lakehouse-iceberg",
    name: "Lakehouse - Iceberg Medallion + ACID",
    subtitle: "Open table format · time travel · schema evolution",
    category: "Lakehouse",
    architecture: "lakehouse",
    architectureTags: ["lakehouse", "medallion"],
    difficulty: "Intermediate",
    badge: "Lakehouse",
    icon: "🏔",
    description: "Modern lakehouse: Iceberg tables at each medallion layer with ACID commits, time travel, and hidden partitioning. Glue catalog + PVDM proof on gold commits.",
    whenToUse: "Replace Hive tables or data lake Parquet with ACID guarantees and concurrent writers.",
    exampleScenario: "CDC from Postgres → Iceberg bronze → MERGE silver → aggregate gold with VRP proof per commit.",
    exampleFlow: "DMS CDC → Iceberg bronze → MERGE silver → Agg gold → VRP proof",
    architectureDiagram: "DMS → Iceberg bronze → Iceberg silver (MERGE) → Iceberg gold (ACID + VRP)",
    awsServices: ["DMS", "Glue", "Iceberg", "S3", "Athena"],
    ...medallionPattern({
      id: "lakehouse",
      name: "lakehouse-orders",
      domain: "analytics",
      source: { sourceType: "rds", awsService: "dms", database: "oltp", table: "orders", cdcEnabled: true, primaryKey: "order_id", detail: "🔄 DMS CDC" },
      bronzeSql: "SELECT *, metadata$operation AS _op FROM bronze.orders_cdc",
      silverSql: "MERGE INTO silver.orders AS t USING bronze.orders_cdc s ON t.order_id = s.order_id WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *",
      goldLocation: "s3://lakehouse-gold/orders_kpi/",
      goldTable: "orders_kpi",
    }),
    customizeTips: ["Iceberg = ACID + time travel.", "Use MERGE in silver for CDC.", "VRP gates gold commits."],
  },

  // ── KAPPA ─────────────────────────────────────────────────────
  {
    id: "arch-kappa-stream-only",
    name: "Kappa Architecture - Stream-Only",
    subtitle: "No batch layer · replay from log · κ",
    category: "Kappa",
    architecture: "kappa",
    architectureTags: ["kappa", "streaming"],
    difficulty: "Advanced",
    badge: "Kappa",
    icon: "κ",
    description: "Kappa: treat everything as a stream. Historical reprocessing = replay the log with a new versioned job. No separate batch ETL layer.",
    whenToUse: "High-volume event streams where batch+stream dual pipelines (Lambda arch) are too costly to maintain.",
    exampleScenario: "Clickstream on Kinesis → Flink/Glue streaming → Iceberg gold; backfill = replay Kinesis epoch.",
    exampleFlow: "Kinesis → Glue Streaming → Dedupe → Enrich → Iceberg (single path)",
    architectureDiagram: "Kinesis (log) ──▶ Glue Streaming ──▶ Iceberg gold\n     ↑ replay for reprocessing (new job version)",
    awsServices: ["Kinesis", "Glue", "Flink", "Iceberg", "Lambda"],
    nodes: [
      { id: "src", type: "pipeline", position: { x: 80, y: 180 }, data: { label: "Kinesis Stream", blockType: "source", sourceType: "kinesis", awsService: "kinesis", endpoint: "arn:aws:kinesis:us-east-1:123456789012:stream/clicks", detail: "🌊 Kinesis · log" } },
      { id: "str", type: "pipeline", position: { x: 300, y: 180 }, data: { label: "Glue Streaming", blockType: "transform", transformType: "glue_etl", awsService: "flink", processingMode: "stream_window", executionMode: "stream", sparkSql: "SELECT window, user_id, COUNT(*) clicks FROM stream.clicks GROUP BY window, user_id", detail: "〰 Flink · κ path" } },
      { id: "ded", type: "pipeline", position: { x: 520, y: 180 }, data: { label: "Dedupe", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "dedupe", executionMode: "stream", sparkSql: "SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY ts DESC) rn FROM stream.events) WHERE rn=1", detail: "Dedupe · event_id" } },
      { id: "enr", type: "pipeline", position: { x: 740, y: 180 }, data: { label: "Enrichment", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "enrichment", executionMode: "stream", sparkSql: "SELECT e.*, d.campaign FROM events e LEFT JOIN dim_campaigns d ON e.campaign_id = d.id", detail: "Enrichment join" } },
      { id: "gt", type: "pipeline", position: { x: 960, y: 180 }, data: { label: "VRP Gate", blockType: "integrity_gate", awsService: "lambda" } },
      { id: "sk", type: "pipeline", position: { x: 1180, y: 180 }, data: { label: "Iceberg Gold", blockType: "sink", targetType: "iceberg", awsService: "iceberg", location: "s3://kappa-gold/clicks/", catalogDatabase: "kappa_gold", catalogTable: "click_metrics" } },
    ],
    edges: [
      { id: "e1", source: "src", target: "str" },
      { id: "e2", source: "str", target: "ded" },
      { id: "e3", source: "ded", target: "enr" },
      { id: "e4", source: "enr", target: "gt" },
      { id: "e5", source: "gt", target: "sk" },
    ],
    pipelineMeta: { name: "kappa-clicks", domain: "digital", version: "1.0.0", executionMode: "stream" },
    customizeTips: ["Reprocess = new job version + replay stream.", "No nightly batch layer needed."],
  },

  // ── LAMBDA ARCHITECTURE ───────────────────────────────────────
  {
    id: "arch-lambda-batch-speed",
    name: "Lambda Architecture (λ) - Batch + Speed Layers",
    subtitle: "Batch view + real-time speed layer · merge at query",
    category: "Lambda Architecture",
    architecture: "lambda_arch",
    architectureTags: ["lambda_arch", "streaming", "datalake"],
    difficulty: "Expert",
    badge: "Lambda λ",
    icon: "λ",
    description: "Lambda architecture: batch layer (Glue daily ETL to Iceberg serving layer) + speed layer (Kinesis/Flink real-time aggregates) merged at query time in Athena/Redshift.",
    whenToUse: "Need both accurate batch history and low-latency recent data - classic λ before full Kappa migration.",
    exampleScenario: "E-commerce: nightly batch revenue + Kinesis speed layer last-hour sales → Athena UNION view.",
    exampleFlow: "Parallel[Batch: S3→Glue→Iceberg | Speed: Kinesis→Flink→Iceberg] → Merge → Athena serving",
    architectureDiagram:
      "         ┌─ Batch (Glue daily) ──▶ Iceberg batch/\nSource ──┤\n         └─ Speed (Kinesis) ──▶ Iceberg speed/\n                    ↓\n              Athena VIEW = UNION",
    awsServices: ["Glue", "Kinesis", "Flink", "Iceberg", "Athena", "Step Functions"],
    nodes: [
      { id: "st", type: "pipeline", position: { x: 40, y: 220 }, data: { label: "Start", blockType: "start" } },
      { id: "par", type: "pipeline", position: { x: 160, y: 220 }, data: { label: "Parallel", blockType: "parallel", branchCount: 2 } },
      { id: "bs", type: "pipeline", position: { x: 360, y: 100 }, data: { label: "S3 History", blockType: "source", sourceType: "s3", awsService: "s3", endpoint: "s3://lambda-batch/history/", detail: "Batch layer input" } },
      { id: "bt", type: "pipeline", position: { x: 560, y: 100 }, data: { label: "Batch ETL", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "etl", executionMode: "batch", schedule: "0 2 * * *", sparkSql: "SELECT DATE(ts) d, SUM(revenue) revenue FROM history GROUP BY 1", detail: "🧊 Batch layer" } },
      { id: "bsk", type: "pipeline", position: { x: 760, y: 100 }, data: { label: "Batch Iceberg", blockType: "sink", targetType: "iceberg", awsService: "iceberg", location: "s3://lambda-serving/batch/", catalogDatabase: "lambda", catalogTable: "revenue_batch" } },
      { id: "ss", type: "pipeline", position: { x: 360, y: 340 }, data: { label: "Kinesis Live", blockType: "source", sourceType: "kinesis", awsService: "kinesis", endpoint: "sales-realtime", detail: "🌊 Speed layer" } },
      { id: "st2", type: "pipeline", position: { x: 560, y: 340 }, data: { label: "Speed Stream", blockType: "transform", transformType: "glue_etl", awsService: "flink", processingMode: "stream_window", executionMode: "stream", sparkSql: "SELECT window, SUM(revenue) revenue FROM stream.sales GROUP BY window", detail: "〰 Speed layer" } },
      { id: "ssk", type: "pipeline", position: { x: 760, y: 340 }, data: { label: "Speed Iceberg", blockType: "sink", targetType: "iceberg", awsService: "iceberg", location: "s3://lambda-serving/speed/", catalogDatabase: "lambda", catalogTable: "revenue_speed" } },
      { id: "mg", type: "pipeline", position: { x: 980, y: 220 }, data: { label: "Merge", blockType: "merge" } },
      { id: "sv", type: "pipeline", position: { x: 1180, y: 220 }, data: { label: "Serving View", blockType: "sink", targetType: "s3", awsService: "athena", location: "s3://lambda-serving/views/", catalogDatabase: "lambda", catalogTable: "revenue_unified", detail: "🔍 Athena UNION view" } },
    ],
    edges: [
      { id: "e1", source: "st", target: "par" },
      { id: "e2", source: "par", target: "bs", sourceHandle: "b1" },
      { id: "e3", source: "bs", target: "bt" },
      { id: "e4", source: "bt", target: "bsk" },
      { id: "e5", source: "bsk", target: "mg" },
      { id: "e6", source: "par", target: "ss", sourceHandle: "b2" },
      { id: "e7", source: "ss", target: "st2" },
      { id: "e8", source: "st2", target: "ssk" },
      { id: "e9", source: "ssk", target: "mg" },
      { id: "e10", source: "mg", target: "sv" },
    ],
    pipelineMeta: { name: "lambda-revenue", domain: "analytics", version: "1.0.0" },
    customizeTips: ["Batch = complete accurate history.", "Speed = last N minutes/hours.", "Athena view UNIONs both."],
  },

  // ── STREAMING ─────────────────────────────────────────────────
  {
    id: "arch-kinesis-firehose-analytics",
    name: "Kinesis → Firehose → Analytics",
    subtitle: "Real-time ingest · delivery · SQL analytics",
    category: "Streaming",
    architecture: "streaming",
    architectureTags: ["streaming", "kappa"],
    difficulty: "Intermediate",
    badge: "Kinesis",
    icon: "🌊",
    description: "Production streaming stack: producers → Kinesis Data Streams → optional Firehose delivery to S3/Iceberg → Glue streaming ETL → enriched gold → fan-out to analytics.",
    whenToUse: "Clickstream, IoT telemetry, application logs, or event-driven microservices.",
    exampleScenario: "Mobile app events → Kinesis → Firehose buffers to S3 bronze → Glue enriches → Iceberg gold → Athena dashboard.",
    exampleFlow: "API → Kinesis → Firehose → S3 bronze → Glue enrich → Iceberg → Athena",
    architectureDiagram: "Producers → Kinesis → Firehose → S3\n                ↘ Glue Streaming → Iceberg gold",
    awsServices: ["Kinesis", "Firehose", "Glue", "Iceberg", "Athena", "Lambda"],
    nodes: [
      { id: "src", type: "pipeline", position: { x: 60, y: 160 }, data: { label: "Kinesis Stream", blockType: "source", sourceType: "kinesis", awsService: "kinesis", endpoint: "app-events", detail: "🌊 Data Streams" } },
      { id: "fh", type: "pipeline", position: { x: 280, y: 160 }, data: { label: "Firehose Delivery", blockType: "transform", transformType: "passthrough", awsService: "firehose", processingMode: "elt", executionMode: "stream", detail: "🔥 Firehose → S3 buffer" } },
      { id: "br", type: "pipeline", position: { x: 500, y: 160 }, data: { label: "Bronze S3", blockType: "sink", targetType: "s3", awsService: "s3", location: "s3://stream-bronze/events/", detail: "🪣 buffered raw" } },
      { id: "en", type: "pipeline", position: { x: 500, y: 300 }, data: { label: "Glue Enrich", blockType: "transform", transformType: "glue_etl", awsService: "glue", processingMode: "enrichment", executionMode: "stream", sparkSql: "SELECT e.*, u.country FROM events e JOIN users u ON e.user_id = u.id", detail: "🧊 streaming enrich" } },
      { id: "gt", type: "pipeline", position: { x: 720, y: 300 }, data: { label: "Stream Gate", blockType: "integrity_gate", awsService: "lambda" } },
      { id: "gd", type: "pipeline", position: { x: 940, y: 300 }, data: { label: "Gold Iceberg", blockType: "sink", targetType: "iceberg", awsService: "iceberg", location: "s3://stream-gold/events/", catalogDatabase: "streaming_gold", catalogTable: "app_events" } },
    ],
    edges: [
      { id: "e1", source: "src", target: "fh" },
      { id: "e2", source: "fh", target: "br" },
      { id: "e3", source: "br", target: "en" },
      { id: "e4", source: "en", target: "gt" },
      { id: "e5", source: "gt", target: "gd" },
    ],
    pipelineMeta: { name: "kinesis-app-events", domain: "digital", version: "1.0.0", executionMode: "stream" },
    customizeTips: ["Firehose = managed delivery to S3.", "Glue streaming reads bronze or Kinesis directly."],
  },
  {
    id: "arch-msk-glue-streaming",
    name: "MSK → Glue Streaming → Lakehouse",
    subtitle: "Kafka-compatible · exactly-once · MSK",
    category: "Streaming",
    architecture: "streaming",
    architectureTags: ["streaming", "lakehouse"],
    difficulty: "Advanced",
    badge: "MSK",
    icon: "📨",
    description: "Amazon MSK (Managed Kafka) as durable log, Glue streaming ETL with window aggregations, MERGE into Iceberg silver, publish gold metrics.",
    whenToUse: "Event-driven architecture already on Kafka/MSK; need managed AWS streaming to lakehouse.",
    exampleScenario: "Order events on MSK topic orders.events → 1-min windows → MERGE silver → hourly gold KPIs.",
    exampleFlow: "MSK topic → Glue streaming window → CDC merge silver → aggregate gold",
    architectureDiagram: "MSK topic → Glue Streaming (windows) → Iceberg silver MERGE → gold KPIs",
    awsServices: ["MSK", "Glue", "Iceberg", "Schema Registry", "Lambda"],
    nodes: [
      { id: "src", type: "pipeline", position: { x: 80, y: 180 }, data: { label: "MSK Topic", blockType: "source", sourceType: "kafka", awsService: "msk", endpoint: "orders.events", detail: "📨 MSK · Kafka" } },
      { id: "win", type: "pipeline", position: { x: 300, y: 180 }, data: { label: "Window Agg", blockType: "transform", transformType: "glue_etl", awsService: "glue", processingMode: "stream_window", executionMode: "stream", sparkSql: "SELECT window, COUNT(*) orders, SUM(amount) gmv FROM stream.orders GROUP BY window", detail: "🧊 1-min windows" } },
      { id: "mrg", type: "pipeline", position: { x: 520, y: 180 }, data: { label: "CDC Merge", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "cdc_merge", sparkSql: "MERGE INTO silver.orders t USING stream.orders s ON t.id=s.id WHEN MATCHED THEN UPDATE SET * WHEN NOT MATCHED THEN INSERT *", detail: "CDC merge silver" } },
      { id: "agg", type: "pipeline", position: { x: 740, y: 180 }, data: { label: "Gold KPIs", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "aggregate", sparkSql: "SELECT hour, SUM(gmv) gmv FROM silver.orders GROUP BY hour", detail: "Aggregate gold" } },
      { id: "gt", type: "pipeline", position: { x: 960, y: 180 }, data: { label: "PVDM Gate", blockType: "integrity_gate" } },
      { id: "sk", type: "pipeline", position: { x: 1180, y: 180 }, data: { label: "Iceberg Gold", blockType: "sink", targetType: "iceberg", awsService: "iceberg", location: "s3://msk-gold/order_kpis/", catalogDatabase: "streaming_gold", catalogTable: "order_kpis" } },
    ],
    edges: [
      { id: "e1", source: "src", target: "win" },
      { id: "e2", source: "win", target: "mrg" },
      { id: "e3", source: "mrg", target: "agg" },
      { id: "e4", source: "agg", target: "gt" },
      { id: "e5", source: "gt", target: "sk" },
    ],
    pipelineMeta: { name: "msk-order-stream", domain: "commerce", version: "1.0.0", executionMode: "stream" },
    customizeTips: ["MSK = managed Kafka.", "Use Glue Schema Registry for Avro/Protobuf."],
  },

  // ── ETL / ELT FACTORY ─────────────────────────────────────────
  {
    id: "arch-glue-etl-factory",
    name: "Glue ETL Factory - Multi-Stage Pipeline",
    subtitle: "ETL · enrichment · DQ · aggregate chain",
    category: "ETL / ELT",
    architecture: "lakehouse",
    architectureTags: ["lakehouse", "medallion"],
    difficulty: "Advanced",
    badge: "Glue ETL",
    icon: "🧊",
    description: "Enterprise ETL chain entirely on AWS Glue: extract (DMS) → ELT bronze → ETL cleanse → enrichment joins → DQ quarantine → aggregate gold. Shows full transform richness.",
    whenToUse: "Complex batch pipeline with multiple transform stages - typical data engineer workflow on Glue.",
    exampleScenario: "SAP extract via DMS → bronze Parquet → typed silver → enrich with MDM → quarantine bad rows → gold star schema.",
    exampleFlow: "DMS → ELT → ETL → Enrich → DQ → Aggregate → Gate → Iceberg",
    architectureDiagram: "DMS → ELT → ETL → Enrich → DQ → Agg → VRP → Iceberg",
    awsServices: ["DMS", "Glue", "Iceberg", "S3", "Step Functions"],
    nodes: [
      { id: "src", type: "pipeline", position: { x: 40, y: 200 }, data: { label: "DMS Extract", blockType: "source", sourceType: "rds", awsService: "dms", database: "sap", table: "materials", cdcEnabled: true, primaryKey: "material_id", detail: "🔄 DMS CDC" } },
      { id: "elt", type: "pipeline", position: { x: 220, y: 200 }, data: { label: "ELT Bronze", blockType: "transform", transformType: "glue_etl", awsService: "glue", processingMode: "elt", sparkSql: "SELECT * FROM raw.materials", detail: "ELT load raw" } },
      { id: "etl", type: "pipeline", position: { x: 400, y: 200 }, data: { label: "ETL Cleanse", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "etl", sparkSql: "SELECT material_id, TRIM(name) name, CAST(weight AS double) weight FROM bronze.materials", detail: "ETL typing" } },
      { id: "enr", type: "pipeline", position: { x: 580, y: 200 }, data: { label: "MDM Enrich", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "enrichment", sparkSql: "SELECT m.*, c.category, c.supplier FROM silver.materials m JOIN gold.dim_category c ON m.cat_id=c.id", detail: "Enrichment" } },
      { id: "dq", type: "pipeline", position: { x: 760, y: 200 }, data: { label: "DQ Quarantine", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "quality", sparkRulesEnabled: true, qualityPolicyId: "strict-zero-drop", sparkSql: "SELECT * FROM enriched WHERE material_id IS NOT NULL AND weight > 0", detail: "DQ quarantine" } },
      { id: "agg", type: "pipeline", position: { x: 940, y: 200 }, data: { label: "Star Aggregate", blockType: "transform", transformType: "spark_sql", awsService: "glue", processingMode: "aggregate", sparkSql: "SELECT category, supplier, COUNT(*) cnt, AVG(weight) avg_w FROM dq.materials GROUP BY 1,2", detail: "Aggregate" } },
      { id: "gt", type: "pipeline", position: { x: 1120, y: 200 }, data: { label: "VRP Gate", blockType: "integrity_gate" } },
      { id: "sk", type: "pipeline", position: { x: 1300, y: 200 }, data: { label: "Gold Star", blockType: "sink", targetType: "iceberg", awsService: "iceberg", location: "s3://etl-factory-gold/materials/", catalogDatabase: "gold", catalogTable: "materials_star" } },
    ],
    edges: [
      { id: "e1", source: "src", target: "elt" },
      { id: "e2", source: "elt", target: "etl" },
      { id: "e3", source: "etl", target: "enr" },
      { id: "e4", source: "enr", target: "dq" },
      { id: "e5", source: "dq", target: "agg" },
      { id: "e6", source: "agg", target: "gt" },
      { id: "e7", source: "gt", target: "sk" },
    ],
    pipelineMeta: { name: "glue-etl-materials", domain: "supply-chain", version: "1.0.0" },
    customizeTips: ["Each stage = separate Glue job in SFN.", "DQ stage drops/quarantines before gold."],
  },
  {
    id: "arch-elt-redshift",
    name: "ELT - Load First → Redshift Transform",
    subtitle: "S3 copy → Redshift SQL → marts",
    category: "ETL / ELT",
    architecture: "warehouse",
    architectureTags: ["datalake", "warehouse"],
    difficulty: "Intermediate",
    badge: "ELT",
    icon: "🏢",
    description: "Classic cloud ELT: land raw files on S3, COPY into Redshift staging, transform with SQL inside the warehouse, publish marts. Glue orchestrates the COPY.",
    whenToUse: "Warehouse-centric teams; transforms live in Redshift SQL not Spark.",
    exampleScenario: "Nightly CSV drops on S3 → Glue triggers COPY → Redshift staging → SQL marts → BI tools.",
    exampleFlow: "S3 files → Glue COPY → Redshift staging → SQL mart → Redshift sink",
    architectureDiagram: "S3 landing → Glue COPY → Redshift staging → SQL transforms → marts",
    awsServices: ["S3", "Glue", "Redshift", "Step Functions"],
    nodes: [
      { id: "src", type: "pipeline", position: { x: 80, y: 180 }, data: { label: "S3 Landing", blockType: "source", sourceType: "s3", awsService: "s3", endpoint: "s3://elt-landing/csv/", detail: "🪣 CSV drops" } },
      { id: "cpy", type: "pipeline", position: { x: 300, y: 180 }, data: { label: "Glue COPY", blockType: "transform", transformType: "glue_etl", awsService: "glue", processingMode: "elt", sparkSql: "-- COPY INTO redshift staging\nLOAD FROM s3://elt-landing/csv/", detail: "🧊 COPY to RS" } },
      { id: "sql", type: "pipeline", position: { x: 520, y: 180 }, data: { label: "RS SQL Mart", blockType: "transform", transformType: "spark_sql", awsService: "redshift", processingMode: "sql", sparkSql: "SELECT customer_id, SUM(revenue) ltv FROM staging.orders GROUP BY 1", detail: "🏢 Redshift SQL" } },
      { id: "gt", type: "pipeline", position: { x: 740, y: 180 }, data: { label: "Gate", blockType: "integrity_gate" } },
      { id: "sk", type: "pipeline", position: { x: 960, y: 180 }, data: { label: "Redshift Mart", blockType: "sink", targetType: "redshift", awsService: "redshift", location: "s3://elt-marts/ltv/", catalogDatabase: "marts", catalogTable: "customer_ltv" } },
    ],
    edges: [
      { id: "e1", source: "src", target: "cpy" },
      { id: "e2", source: "cpy", target: "sql" },
      { id: "e3", source: "sql", target: "gt" },
      { id: "e4", source: "gt", target: "sk" },
    ],
    pipelineMeta: { name: "elt-customer-ltv", domain: "analytics", version: "1.0.0" },
    customizeTips: ["Transform SQL runs inside Redshift.", "Glue = orchestrator + COPY."],
  },
];
