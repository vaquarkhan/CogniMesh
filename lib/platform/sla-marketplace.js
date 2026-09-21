"use strict";

const { notifySlaBreach, sendNotification } = require("./notifications");

const slaSubscriptions = [];

function subscribeSla({ productId, consumerId, slaMinutes, penalty, webhookUrl, channel }) {
  const sub = {
    id: `sla-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId,
    consumerId,
    slaMinutes: slaMinutes || 1440,
    penalty: penalty || "credit",
    webhookUrl: webhookUrl || null,
    channel: channel || "slack",
    createdAt: new Date().toISOString(),
    status: "active",
    lastNotifiedAt: null,
  };
  slaSubscriptions.push(sub);
  return sub;
}

function listSlaSubscriptions(productId) {
  return productId
    ? slaSubscriptions.filter((s) => s.productId === productId)
    : [...slaSubscriptions];
}

function checkSlaCompliance({ productId, lastRunAt }) {
  const subs = listSlaSubscriptions(productId);
  if (!subs.length || !lastRunAt) return { compliant: true, subs: [], breached: [] };

  const hoursSince = (Date.now() - new Date(lastRunAt).getTime()) / 3600000;
  const mapped = subs.map((s) => ({
    ...s,
    hoursSince: Math.round(hoursSince * 10) / 10,
    actualMinutes: Math.round(hoursSince * 60),
    breached: hoursSince * 60 > s.slaMinutes,
  }));
  return {
    compliant: mapped.every((s) => !s.breached),
    subs: mapped,
    breached: mapped.filter((s) => s.breached),
  };
}

async function postCustomWebhook(url, payload) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

/**
 * Evaluate SLA subscriptions and notify on breach (opt-in via notify=true callers).
 */
async function evaluateAndNotifySla({ productId, lastProofAt, lastRunAt, domain, productName }) {
  const when = lastProofAt || lastRunAt;
  const check = checkSlaCompliance({ productId, lastRunAt: when });
  const notifications = [];

  if (!when || check.compliant) {
    return { ...check, notified: false, notifications };
  }

  for (const sub of check.breached) {
    const title = `SLA breach: ${productName || productId}`;
    const body = `Product: ${productId}\nDomain: ${domain || ""}\nSLA: ${sub.slaMinutes}m · Actual: ${sub.actualMinutes}m\nConsumer: ${sub.consumerId || "n/a"}`;

    let result;
    if (sub.webhookUrl) {
      result = await postCustomWebhook(sub.webhookUrl, {
        event: "sla_breach",
        productId,
        domain: domain || null,
        slaMinutes: sub.slaMinutes,
        actualMinutes: sub.actualMinutes,
        consumerId: sub.consumerId,
        text: `*${title}*\n${body}`,
      });
    } else {
      result = await notifySlaBreach({
        pipelineName: productName || productId,
        domain: domain || "",
        slaMinutes: sub.slaMinutes,
        actualMinutes: sub.actualMinutes,
      });
      if (!result.sent && sub.channel && sub.channel !== "slack") {
        result = await sendNotification({
          channel: sub.channel,
          event: "sla_breach",
          title,
          body,
          severity: "critical",
        });
      }
    }

    sub.lastNotifiedAt = new Date().toISOString();
    const stored = slaSubscriptions.find((s) => s.id === sub.id);
    if (stored) stored.lastNotifiedAt = sub.lastNotifiedAt;
    notifications.push({ subscriptionId: sub.id, ...result });
  }

  return {
    ...check,
    notified: notifications.some((n) => n.sent),
    notifications,
  };
}

/** Test helper — clear in-memory subscriptions. */
function _resetSlaSubscriptionsForTests() {
  slaSubscriptions.length = 0;
}

module.exports = {
  subscribeSla,
  listSlaSubscriptions,
  checkSlaCompliance,
  evaluateAndNotifySla,
  _resetSlaSubscriptionsForTests,
};
