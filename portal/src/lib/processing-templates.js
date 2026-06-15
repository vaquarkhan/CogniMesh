/** Default Spark SQL / config snippets per processing mode (data architect presets). */

export const PROCESSING_TEMPLATES = {
  etl: {
    sparkSql: `-- ETL: transform before landing in gold
SELECT
  id,
  TRIM(LOWER(email)) AS email,
  CAST(amount AS DECIMAL(18,2)) AS amount,
  current_timestamp() AS processed_at
FROM bronze.raw_events
WHERE id IS NOT NULL`,
    detail: "ETL · transform-first",
  },
  elt: {
    sparkSql: `-- ELT: load raw to bronze, transform in-place
CREATE OR REPLACE TEMP VIEW staged AS
SELECT * FROM bronze.raw_landing;
SELECT * FROM staged`,
    detail: "ELT · load-first",
  },
  enrichment: {
    sparkSql: `-- Enrichment: join dimension / lookup
SELECT
  e.event_id,
  e.customer_id,
  c.segment,
  c.region,
  e.amount
FROM silver.events e
LEFT JOIN gold.dim_customers c ON e.customer_id = c.customer_id`,
    detail: "Enrichment · lookup join",
  },
  dedupe: {
    sparkSql: `-- Dedupe: keep latest by business key
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn
  FROM bronze.orders
) WHERE rn = 1`,
    detail: "Dedupe · latest wins",
  },
  aggregate: {
    sparkSql: `-- Aggregation: daily KPIs
SELECT
  DATE(created_at) AS business_date,
  region,
  COUNT(*) AS order_count,
  SUM(amount) AS revenue
FROM silver.orders
GROUP BY 1, 2`,
    detail: "Aggregate · KPI rollups",
  },
  cdc_merge: {
    sparkSql: `-- CDC merge: upsert pattern
MERGE INTO silver.orders t
USING bronze.orders_cdc s ON t.order_id = s.order_id
WHEN MATCHED AND s._cdc_op = 'D' THEN DELETE
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *`,
    detail: "CDC merge · upsert",
  },
  stream_window: {
    sparkSql: `-- Stream window: 5-min tumbling
SELECT
  window(start_time, '5 minutes') AS w,
  product_id,
  COUNT(*) AS events,
  SUM(qty) AS units
FROM stream.clicks
GROUP BY window(start_time, '5 minutes'), product_id`,
    detail: "Stream · 5m window",
    executionMode: "stream",
  },
  sql: {
    sparkSql: "SELECT * FROM bronze.input WHERE id IS NOT NULL",
    detail: "Spark SQL",
  },
  quality: {
    sparkSql: `SELECT * FROM silver.orders
WHERE order_id IS NOT NULL AND amount >= 0`,
    detail: "DQ · quarantine invalid",
    sparkRulesEnabled: true,
    qualityPolicyId: "strict-zero-drop",
  },
};

export function applyProcessingTemplate(mode) {
  return PROCESSING_TEMPLATES[mode] || PROCESSING_TEMPLATES.sql;
}
