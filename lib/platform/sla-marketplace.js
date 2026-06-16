"use strict";

const slaSubscriptions = [];

function subscribeSla({ productId, consumerId, slaMinutes, penalty }) {
  const sub = {
    id: `sla-${Date.now()}`,
    productId,
    consumerId,
    slaMinutes: slaMinutes || 1440,
    penalty: penalty || "credit",
    createdAt: new Date().toISOString(),
    status: "active",
  };
  slaSubscriptions.push(sub);
  return sub;
}

function listSlaSubscriptions(productId) {
  return productId
    ? slaSubscriptions.filter((s) => s.productId === productId)
    : slaSubscriptions;
}

function checkSlaCompliance({ productId, lastRunAt }) {
  const subs = listSlaSubscriptions(productId);
  if (!subs.length || !lastRunAt) return { compliant: true, subs: [] };

  const hoursSince = (Date.now() - new Date(lastRunAt).getTime()) / 3600000;
  return {
    compliant: subs.every((s) => hoursSince * 60 <= s.slaMinutes),
    subs: subs.map((s) => ({
      ...s,
      hoursSince: Math.round(hoursSince * 10) / 10,
      breached: hoursSince * 60 > s.slaMinutes,
    })),
  };
}

module.exports = { subscribeSla, listSlaSubscriptions, checkSlaCompliance };
