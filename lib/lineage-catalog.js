"use strict";

/**
 * CogniMesh Lineage Catalog — medallion graph + consumer edges per data product.
 * @see docs/LINEAGE_CATALOG.md
 */

const lineageByProductId = new Map();
const lineageByKey = new Map();

function productKey(domain, name) {
  return `${domain}/${name}`;
}

function buildLineageGraph(contract) {
  const { metadata, spec } = contract;
  const layers = spec.transform?.layers || ["bronze", "silver", "gold"];
  const transformType = spec.transform?.type || "spark_sql";
  const nodes = [];
  const edges = [];

  const addNode = (node) => nodes.push(node);
  const link = (source, target, label) => {
    edges.push({ id: `${source}->${target}`, source, target, label });
  };

  addNode({
    id: "source",
    type: "source",
    label: spec.source.type,
    detail: spec.source.connection?.table || spec.source.type,
  });

  let prev = "source";
  for (const layer of layers) {
    const id = `layer-${layer}`;
    addNode({
      id,
      type: "medallion",
      layer,
      label: layer.charAt(0).toUpperCase() + layer.slice(1),
      detail: transformType,
    });
    link(prev, id, layer === "bronze" ? "ingest" : "transform");
    prev = id;
  }

  const targetId = "gold-product";
  addNode({
    id: targetId,
    type: "target",
    label: spec.target.catalog?.table || metadata.name,
    detail: spec.target.type,
    location: spec.target.location,
    catalog: spec.target.catalog,
  });
  link(prev, targetId, "publish");

  addNode({
    id: "integrity-gate",
    type: "governance",
    label: "Integrity Gate",
    detail: "design-time rules",
  });
  link(targetId, "integrity-gate", "validate");

  addNode({
    id: "marketplace",
    type: "marketplace",
    label: "Marketplace",
    detail: "approved product",
  });
  link("integrity-gate", "marketplace", "register");

  addNode({
    id: "consumers",
    type: "consumer",
    label: "Consumers",
    detail: "Lake Formation · row filters",
  });
  link("marketplace", "consumers", "grant");

  if (spec.execution?.pattern === "vaquar") {
    addNode({
      id: "pvdm",
      type: "runtime",
      label: "Vaquar PVDM",
      detail: "Physical → Verify → Durable → Metadata",
    });
    link(`layer-${layers[layers.length - 1] || "gold"}`, "pvdm", "VRP");
    link("pvdm", targetId, "commit");
  }

  return {
    productKey: productKey(metadata.domain, metadata.name),
    domain: metadata.domain,
    name: metadata.name,
    version: metadata.version,
    pattern: spec.execution?.pattern || "vaquar",
    nodes,
    edges,
    schemaEvolution: spec.schemaEvolution || { policy: "compatible" },
    columns: (spec.source?.schema || []).map((c) => c.name),
    sourceSchema: spec.source?.schema || [],
    updatedAt: new Date().toISOString(),
  };
}

function saveLineage(productId, contract) {
  const graph = buildLineageGraph(contract);
  graph.productId = productId;
  lineageByProductId.set(productId, graph);
  lineageByKey.set(graph.productKey, graph);
  return graph;
}

function getLineage(productId) {
  return lineageByProductId.get(productId) || lineageByKey.get(productId) || null;
}

function getLineageByKey(domain, name) {
  return lineageByKey.get(productKey(domain, name)) || null;
}

function listLineageCatalog(domain) {
  let items = [...lineageByProductId.values()];
  if (domain) {
    items = items.filter((g) => g.domain === domain);
  }
  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function lineageCatalogSummary() {
  const items = listLineageCatalog();
  return {
    totalProducts: items.length,
    domains: [...new Set(items.map((i) => i.domain))],
    patterns: items.reduce((acc, i) => {
      acc[i.pattern] = (acc[i.pattern] || 0) + 1;
      return acc;
    }, {}),
    products: items.map((g) => ({
      productId: g.productId,
      productKey: g.productKey,
      domain: g.domain,
      name: g.name,
      version: g.version,
      nodeCount: g.nodes.length,
      updatedAt: g.updatedAt,
    })),
  };
}

module.exports = {
  buildLineageGraph,
  saveLineage,
  getLineage,
  getLineageByKey,
  listLineageCatalog,
  lineageCatalogSummary,
  productKey,
};
