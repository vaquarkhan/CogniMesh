"use strict";

/**
 * Mount /api/v1/marketplace/* routes on the API gateway.
 */

const { startSpan } = require("../tracing");
const {
  searchMarketplace,
  featuredProducts,
  getMarketplaceProduct,
  marketplaceCatalog,
  listDomains,
} = require("./index");
const { subscribeSla, listSlaSubscriptions, checkSlaCompliance } = require("../platform/sla-marketplace");

function mountMarketplaceRoutes(app, { requireAuth }) {
  app.get("/api/v1/marketplace", requireAuth, (_req, res) => {
    res.json(marketplaceCatalog());
  });

  app.get("/api/v1/marketplace/products", requireAuth, async (req, res) => {
    const span = startSpan("api.marketplace.search", { user_id: req.auth?.sub });
    try {
      const result = await searchMarketplace(req.auth || {}, req.query || {});
      span.end(result.status === "success" ? "ok" : "error", {
        total: String(result.total || 0),
        code: result.code || "",
      });
      res.status(result.status === "success" ? 200 : 502).json(result);
    } catch (err) {
      span.end("error", { error: err.message });
      res.status(500).json({
        status: "error",
        code: "MARKETPLACE_SEARCH_FAILED",
        errors: [err.message],
        fixHint: "Check GET /health catalog + otel. See docs/MARKETPLACE.md",
      });
    }
  });

  app.get("/api/v1/marketplace/featured", requireAuth, async (req, res) => {
    const span = startSpan("api.marketplace.featured", { user_id: req.auth?.sub });
    const result = await featuredProducts(req.auth || {}, { limit: req.query.limit });
    span.end(result.status === "success" ? "ok" : "error");
    res.status(result.status === "success" ? 200 : 502).json(result);
  });

  app.get("/api/v1/marketplace/domains", requireAuth, async (req, res) => {
    const result = await listDomains(req.auth || {});
    res.status(result.status === "success" ? 200 : 502).json(result);
  });

  app.get("/api/v1/marketplace/products/:id", requireAuth, async (req, res) => {
    const span = startSpan("api.marketplace.product", {
      user_id: req.auth?.sub,
      product_id: req.params.id,
    });
    const result = await getMarketplaceProduct(req.params.id, req.auth || {});
    span.end(result.status === "success" ? "ok" : "error", { code: result.code || "" });
    res.status(result.status === "success" ? 200 : 404).json(result);
  });

  app.get("/api/v1/marketplace/sla", requireAuth, (req, res) => {
    res.json({
      status: "success",
      subscriptions: listSlaSubscriptions(req.query.productId),
    });
  });

  app.post("/api/v1/marketplace/sla", requireAuth, (req, res) => {
    const body = req.body || {};
    if (!body.productId) {
      return res.status(400).json({
        status: "error",
        code: "SLA_PRODUCT_REQUIRED",
        errors: ["productId is required"],
        fixHint: "POST { productId, consumerId?, slaMinutes?, penalty? }",
      });
    }
    const sub = subscribeSla({
      productId: body.productId,
      consumerId: body.consumerId || req.auth?.sub || "anonymous",
      slaMinutes: body.slaMinutes,
      penalty: body.penalty,
    });
    res.status(201).json({ status: "success", subscription: sub });
  });

  app.get("/api/v1/marketplace/sla/check", requireAuth, (req, res) => {
    if (!req.query.productId) {
      return res.status(400).json({
        status: "error",
        code: "SLA_PRODUCT_REQUIRED",
        errors: ["productId query param required"],
      });
    }
    res.json({
      status: "success",
      ...checkSlaCompliance({
        productId: req.query.productId,
        lastRunAt: req.query.lastRunAt,
      }),
    });
  });
}

module.exports = { mountMarketplaceRoutes };
