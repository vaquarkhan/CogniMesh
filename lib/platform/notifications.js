"use strict";

const { alertDeployFailure } = require("../alerting");

const webhookConfig = {
  slack: process.env.ALERT_WEBHOOK_URL || "",
  teams: process.env.TEAMS_WEBHOOK_URL || "",
  email: process.env.ALERT_EMAIL_TO || "",
};

async function sendNotification({ channel, event, title, body, severity = "warning" }) {
  const url =
    channel === "teams" ? webhookConfig.teams : channel === "slack" ? webhookConfig.slack : null;

  if (!url) {
    return { sent: false, reason: `${channel} webhook not configured` };
  }

  const payload =
    channel === "teams"
      ? { "@type": "MessageCard", summary: title, text: body }
      : { text: `*${title}*\n${body}` };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    return { sent: res.ok, status: res.status, channel, event, severity };
  } catch (err) {
    return { sent: false, error: err.message, channel };
  }
}

async function notifyPipelineFailure(ctx) {
  await alertDeployFailure(ctx);
  return sendNotification({
    channel: "slack",
    event: "pipeline_failure",
    title: `Pipeline failed: ${ctx.pipelineName}`,
    body: [ctx.domain, ctx.stage, ...(ctx.errors || []).slice(0, 3)].filter(Boolean).join("\n"),
    severity: "error",
  });
}

async function notifySlaBreach({ pipelineName, domain, slaMinutes, actualMinutes }) {
  return sendNotification({
    channel: "slack",
    event: "sla_breach",
    title: `SLA breach: ${pipelineName}`,
    body: `Domain: ${domain}\nSLA: ${slaMinutes}m · Actual: ${actualMinutes}m`,
    severity: "critical",
  });
}

function getNotificationConfig() {
  return {
    slack: Boolean(webhookConfig.slack),
    teams: Boolean(webhookConfig.teams),
    email: Boolean(webhookConfig.email),
    pagerduty: Boolean(process.env.PAGERDUTY_ROUTING_KEY),
  };
}

module.exports = {
  sendNotification,
  notifyPipelineFailure,
  notifySlaBreach,
  getNotificationConfig,
};
