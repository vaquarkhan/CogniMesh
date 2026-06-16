"use strict";

const fs = require("fs");
const path = require("path");

const events = [];

const storePath = () =>
  process.env.BILLING_STORE_PATH || path.join(process.cwd(), "data", "cross-org-billing.json");

const RATE_CARD = {
  query: 0.002,
  egress_gb: 0.09,
  subscription_month: 49,
  sla_penalty: 25,
};

function loadBilling() {
  try {
    const file = storePath();
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(data)) events.push(...data);
  } catch {
    // non-fatal
  }
}

function persistBilling() {
  try {
    const file = storePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(events.slice(-500), null, 2), "utf8");
  } catch {
    // non-fatal
  }
}

loadBilling();

function recordBillingEvent({
  orgId,
  productId,
  consumerId,
  eventType,
  units = 1,
  currency = "USD",
}) {
  const rateKey =
    eventType === "egress" ? "egress_gb" : eventType === "subscription" ? "subscription_month" : "query";
  const unitRate = RATE_CARD[rateKey] || 0.01;
  const amount = Math.round(units * unitRate * 100) / 100;
  const row = {
    id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(),
    orgId: orgId || "local",
    productId,
    consumerId: consumerId || "anonymous",
    eventType: eventType || "query",
    units,
    unitRate,
    amount,
    currency,
  };
  events.unshift(row);
  if (events.length > 500) events.length = 500;
  persistBilling();
  return row;
}

function getBillingDashboard({ orgId, domain } = {}) {
  const filtered = events.filter((e) => {
    if (orgId && e.orgId !== orgId) return false;
    if (domain && !String(e.productId || "").includes(domain)) return false;
    return true;
  });

  const byOrg = {};
  for (const e of filtered) {
    byOrg[e.orgId] = byOrg[e.orgId] || { total: 0, events: 0, products: new Set() };
    byOrg[e.orgId].total += e.amount;
    byOrg[e.orgId].events += 1;
    if (e.productId) byOrg[e.orgId].products.add(e.productId);
  }

  const organizations = Object.entries(byOrg).map(([id, v]) => ({
    orgId: id,
    totalUsd: Math.round(v.total * 100) / 100,
    eventCount: v.events,
    productCount: v.products.size,
  }));

  return {
    currency: "USD",
    rateCard: RATE_CARD,
    totalUsd: Math.round(filtered.reduce((a, e) => a + e.amount, 0) * 100) / 100,
    organizations,
    recent: filtered.slice(0, 25),
  };
}

function seedFederatedBillingIfEmpty(federatedOrgs = []) {
  if (events.length > 0) return;
  for (const org of federatedOrgs) {
    recordBillingEvent({
      orgId: org.orgId,
      productId: `fed-${org.orgId}-customer-360`,
      consumerId: "analytics-team",
      eventType: "subscription",
      units: 1,
    });
    recordBillingEvent({
      orgId: org.orgId,
      productId: `fed-${org.orgId}-customer-360`,
      consumerId: "ml-feature-store",
      eventType: "query",
      units: 1200,
    });
  }
}

module.exports = {
  recordBillingEvent,
  getBillingDashboard,
  seedFederatedBillingIfEmpty,
  RATE_CARD,
};
