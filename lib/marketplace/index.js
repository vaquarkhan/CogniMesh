"use strict";

/**
 * Marketplace API facade: discovery, trust ranking, facets, and consumer links.
 * Complements raw /api/v1/products catalog proxy with CogniMesh-specific signals.
 */

const { listProducts, getProduct } = require("../catalog-client");
const { productTrust } = require("../vrp/product-trust");
const { proofSla } = require("../vrp/proof-sla");
const { listSlaSubscriptions } = require("../platform/sla-marketplace");
const { getAccessForProduct } = require("../access-requests");

function asProductList(listed) {
  if (!listed) return [];
  if (Array.isArray(listed.products)) return listed.products;
  if (Array.isArray(listed)) return listed;
  return [];
}

function enrichProduct(p = {}) {
  const tags = p.tags || {};
  const trust =
    p.trust ||
    productTrust({
      proofGated: tags.proofGated === "true" || Boolean(p.proofGated),
      vrpVerdict: tags.vrpVerdict || p.vrpVerdict || null,
      conformanceProfile: tags.conformanceProfile || null,
      icebergSnapshotId: tags.icebergSnapshotId || null,
      sourceSnapshotId: tags.sourceSnapshotId || null,
      schemaFingerprint: tags.schemaFingerprint || null,
      lastProofAt: tags.lastProofAt || null,
    });
  const sla = trust.sla || proofSla({ lastProofAt: trust.lastProofAt });
  return {
    ...p,
    trust,
    sla,
    proofGated: Boolean(trust.proofGated),
    links: {
      detail: `/api/v1/marketplace/products/${encodeURIComponent(p.id)}`,
      consumerDetail: `/api/v1/products/${encodeURIComponent(p.id)}/consumer-detail`,
      requestAccess: `/api/v1/products/${encodeURIComponent(p.id)}/access-requests`,
      verify: "/api/v1/proofs/verify",
      diff: "/api/v1/proofs/diff",
    },
  };
}

function matchesQuery(p, q) {
  if (!q) return true;
  const hay = `${p.name || ""} ${p.domain || ""} ${p.description || ""} ${p.version || ""} ${(p.trust?.badges || []).join(" ")}`.toLowerCase();
  return hay.includes(String(q).toLowerCase());
}

function sortProducts(items, sort) {
  const list = [...items];
  switch (sort) {
    case "name":
      return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    case "domain":
      return list.sort((a, b) => String(a.domain || "").localeCompare(String(b.domain || "")));
    case "fresh":
      return list.sort((a, b) => (a.sla?.ageHours ?? 1e9) - (b.sla?.ageHours ?? 1e9));
    case "trust":
    default:
      return list.sort((a, b) => (b.trust?.score || 0) - (a.trust?.score || 0));
  }
}

async function searchMarketplace(auth = {}, query = {}) {
  const {
    q = "",
    domain,
    grade,
    proofGated,
    fresh,
    sort = "trust",
    limit = 50,
    offset = 0,
  } = query;

  const listed = await listProducts(domain || undefined, auth);
  if (listed.source === "error") {
    return {
      status: "error",
      code: "MARKETPLACE_CATALOG_UNAVAILABLE",
      errors: [listed.error || "Catalog unavailable"],
      fixHint: "Start API with CATALOG_STORAGE=memory or bring Spring catalog up on :8080.",
      products: [],
      total: 0,
    };
  }

  let products = asProductList(listed).map(enrichProduct);

  if (q) products = products.filter((p) => matchesQuery(p, q));
  if (grade) {
    const g = String(grade).toUpperCase();
    products = products.filter((p) => p.trust?.grade === g);
  }
  if (proofGated === "true" || proofGated === true) {
    products = products.filter((p) => p.proofGated);
  }
  if (fresh === "true" || fresh === true) {
    products = products.filter((p) => p.sla?.fresh);
  }

  products = sortProducts(products, sort);
  const total = products.length;
  const start = Math.max(0, Number(offset) || 0);
  const take = Math.min(200, Math.max(1, Number(limit) || 50));
  const page = products.slice(start, start + take);

  return {
    status: "success",
    source: listed.source,
    total,
    offset: start,
    limit: take,
    sort,
    filters: { q: q || null, domain: domain || null, grade: grade || null, proofGated: Boolean(proofGated), fresh: Boolean(fresh) },
    products: page,
    facets: buildFacets(asProductList(listed).map(enrichProduct)),
  };
}

function buildFacets(products) {
  const domains = {};
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  let proofGated = 0;
  let fresh = 0;
  for (const p of products) {
    domains[p.domain || "unknown"] = (domains[p.domain || "unknown"] || 0) + 1;
    const g = p.trust?.grade || "D";
    grades[g] = (grades[g] || 0) + 1;
    if (p.proofGated) proofGated += 1;
    if (p.sla?.fresh) fresh += 1;
  }
  return { domains, grades, proofGated, fresh, total: products.length };
}

async function featuredProducts(auth = {}, { limit = 6 } = {}) {
  const result = await searchMarketplace(auth, { sort: "trust", limit: 100 });
  if (result.status !== "success") return result;
  const featured = result.products
    .filter((p) => (p.trust?.score || 0) >= 55 || p.trust?.grade === "A" || p.trust?.grade === "B")
    .slice(0, Math.min(20, Number(limit) || 6));
  return {
    status: "success",
    source: result.source,
    products: featured.length ? featured : result.products.slice(0, Number(limit) || 6),
    criteria: "trust score ≥ 55 (grade A/B) preferred; falls back to top by trust",
  };
}

async function getMarketplaceProduct(id, auth = {}) {
  const fetched = await getProduct(id, auth);
  if (fetched.source === "error" || !fetched.product) {
    return {
      status: "error",
      code: "MARKETPLACE_PRODUCT_NOT_FOUND",
      errors: [fetched.error || `Product not found: ${id}`],
      fixHint: "Deploy a pipeline to register a product, or list via GET /api/v1/marketplace/products",
    };
  }
  const product = enrichProduct(fetched.product);
  const access = getAccessForProduct(id, auth?.sub);
  const slaSubs = listSlaSubscriptions(id);
  return {
    status: "success",
    source: fetched.source,
    product,
    access,
    slaSubscriptions: slaSubs,
    actions: {
      requestAccess: { method: "POST", path: `/api/v1/products/${encodeURIComponent(id)}/access-requests` },
      consumerDetail: { method: "GET", path: `/api/v1/products/${encodeURIComponent(id)}/consumer-detail` },
      subscribeSla: { method: "POST", path: "/api/v1/marketplace/sla", body: { productId: id } },
      verifyProof: { method: "POST", path: "/api/v1/proofs/verify" },
      diffProofs: { method: "POST", path: "/api/v1/proofs/diff" },
    },
  };
}

function marketplaceCatalog() {
  return {
    name: "CogniMesh Marketplace API",
    version: "1.0.0",
    description:
      "Discover proof-gated data products, trust grades, SLA freshness, and consumer actions. Catalog commit still requires VRP PASS.",
    endpoints: [
      { method: "GET", path: "/api/v1/marketplace", summary: "This catalog" },
      { method: "GET", path: "/api/v1/marketplace/products", summary: "Search / filter products", query: ["q", "domain", "grade", "proofGated", "fresh", "sort", "limit", "offset"] },
      { method: "GET", path: "/api/v1/marketplace/products/:id", summary: "Product card + actions" },
      { method: "GET", path: "/api/v1/marketplace/featured", summary: "Top trust-ranked products" },
      { method: "GET", path: "/api/v1/marketplace/domains", summary: "Domain facets" },
      { method: "POST", path: "/api/v1/marketplace/sla", summary: "Subscribe to product SLA" },
      { method: "GET", path: "/api/v1/marketplace/sla", summary: "List SLA subscriptions" },
      { method: "POST", path: "/api/v1/proofs/verify", summary: "Offline VRP verify" },
      { method: "POST", path: "/api/v1/proofs/diff", summary: "Diff two proofs" },
    ],
    honesty: [
      "SDP/dbt success is observational - marketplace publish still needs VRP PASS",
      "Sample rows stay fail-closed until VRP PASS",
      "Lake Formation GrantPermissions is not auto-called on approve yet",
    ],
  };
}

async function listDomains(auth = {}) {
  const result = await searchMarketplace(auth, { limit: 200 });
  if (result.status !== "success") return result;
  return {
    status: "success",
    source: result.source,
    domains: Object.entries(result.facets.domains || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    facets: result.facets,
  };
}

module.exports = {
  searchMarketplace,
  featuredProducts,
  getMarketplaceProduct,
  marketplaceCatalog,
  listDomains,
  enrichProduct,
};
