/**
 * Client-side block validation — mirrors graph-to-contract rules for inline UX.
 */
export function validateBlocks(nodes, edges) {
  const errors = [];
  const byNode = {};

  const source = nodes.find((n) => n.data?.blockType === "source");
  const transform = nodes.find((n) => n.data?.blockType === "transform");
  const sink = nodes.find((n) => n.data?.blockType === "sink");

  for (const type of ["source", "transform", "sink"]) {
    const count = nodes.filter((n) => n.data?.blockType === type).length;
    if (count !== 1) {
      errors.push(`Exactly one ${type} block required (found ${count})`);
    }
  }

  if (source && transform && !edges.some((e) => e.source === source.id && e.target === transform.id)) {
    errors.push("Connect Source → Transform");
    byNode[source.id] = "Not connected to Transform";
  }

  if (transform && sink && !edges.some((e) => e.source === transform.id && e.target === sink.id)) {
    errors.push("Connect Transform → Sink");
    byNode[transform.id] = byNode[transform.id] || "Not connected to Sink";
  }

  if (source?.data?.blockType === "source") {
    const st = source.data.sourceType;
    if ((st === "rds" || st === "mysql") && !source.data.database) {
      byNode[source.id] = "Database name required";
      errors.push("Source: database name required");
    }
    if ((st === "rds" || st === "mysql") && !source.data.table) {
      byNode[source.id] = byNode[source.id] || "Table name required";
      errors.push("Source: table name required");
    }
  }

  if (sink?.data?.blockType === "sink" && !sink.data.location) {
    byNode[sink.id] = "S3 / Iceberg location required";
    errors.push("Sink: target location required");
  }

  if (transform?.data?.blockType === "transform" && transform.data.transformType === "spark_sql") {
    if (!transform.data.sparkSql?.trim()) {
      byNode[transform.id] = "Spark SQL required";
      errors.push("Transform: Spark SQL required");
    }
  }

  return { valid: errors.length === 0, errors, byNode };
}
