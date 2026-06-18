"use strict";

/**
 * CloudWatch Embedded Metric Format (EMF) for ECS/awslogs custom metrics.
 * Enable with ENABLE_EMF_METRICS=true (default on when NODE_ENV=production).
 */

const NAMESPACE = process.env.COGNIMESH_METRICS_NAMESPACE || "CogniMesh";

function emfEnabled() {
  if (process.env.ENABLE_EMF_METRICS === "false") return false;
  if (process.env.ENABLE_EMF_METRICS === "true") return true;
  return process.env.NODE_ENV === "production";
}

function incEmf(name, amount = 1, dimensions = {}) {
  if (!emfEnabled()) return;

  const dims = { service: "cognimesh-api-gateway", ...dimensions };
  const dimKeys = Object.keys(dims);

  const payload = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: NAMESPACE,
          Dimensions: [dimKeys],
          Metrics: [{ Name: name, Unit: "Count" }],
        },
      ],
    },
    ...dims,
    [name]: amount,
  };

  console.log(JSON.stringify(payload));
}

module.exports = { incEmf, emfEnabled };
