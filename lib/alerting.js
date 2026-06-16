"use strict";

/**
 * Deploy failure alerts - Slack-compatible webhook or PagerDuty Events API v2.
 * Set ALERT_WEBHOOK_URL (Slack incoming webhook or generic JSON POST).
 */

async function alertDeployFailure({ pipelineName, domain, errors, userId, stage }) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return { sent: false, reason: "ALERT_WEBHOOK_URL not set" };

  const text = [
    `:warning: *CogniMesh deploy failed*`,
    `Pipeline: \`${pipelineName}\` (${domain || "?"})`,
    stage ? `Stage: ${stage}` : null,
    userId ? `User: ${userId}` : null,
    errors?.length ? `Errors:\n${errors.slice(0, 5).map((e) => `• ${typeof e === "string" ? e : e.message || JSON.stringify(e)}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const payload =
    process.env.ALERT_WEBHOOK_FORMAT === "pagerduty"
      ? {
          routing_key: process.env.PAGERDUTY_ROUTING_KEY || "",
          event_action: "trigger",
          payload: {
            summary: `CogniMesh deploy failed: ${pipelineName}`,
            severity: "error",
            source: "cognimesh-api",
            custom_details: { domain, stage, errors, userId },
          },
        }
      : { text };

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

module.exports = { alertDeployFailure };
