"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const SEMVER = /^\d+\.\d+\.\d+$/;

function loadPolicies(policiesPath) {
  const file =
    policiesPath ||
    path.join(__dirname, "..", "..", "rules", "default-policies.yaml");
  return yaml.load(fs.readFileSync(file, "utf8"));
}

function getByPath(obj, dotPath) {
  return dotPath.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function evaluateAssert(contract, assertion) {
  const failures = [];
  for (const [field, requirement] of Object.entries(assertion)) {
    const value = getByPath(contract, field);
    if (requirement === "required" && (value === undefined || value === null || value === "")) {
      failures.push({ field, message: `${field} is required` });
    }
    if (requirement === "non_empty" && (!value || String(value).trim() === "")) {
      failures.push({ field, message: `${field} must not be empty` });
    }
    if (requirement === "semver" && !SEMVER.test(String(value || ""))) {
      failures.push({ field, message: `${field} must be semver (x.y.z)` });
    }
  }
  return failures;
}

function matchesWhen(contract, when) {
  if (!when) return true;
  for (const [field, expected] of Object.entries(when)) {
    const value = getByPath(contract, field);
    if (typeof expected === "string" && expected.startsWith("!")) {
      if (value === expected.slice(1)) return false;
      continue;
    }
    if (Array.isArray(expected)) {
      if (!expected.includes(value)) return false;
      continue;
    }
    if (value !== expected) return false;
  }
  return true;
}

function checkBlockedPatterns(contract, patterns = []) {
  const violations = [];
  for (const rule of patterns) {
    const value = String(getByPath(contract, rule.field) || "");
    if (!value) continue;
    const re = new RegExp(rule.pattern);
    if (re.test(value)) {
      violations.push({ rule: rule.field, message: rule.message });
    }
  }
  return violations;
}

function requiresSecretArn(contract) {
  const t = contract?.spec?.source?.type;
  if (t === "rds" || t === "mysql") {
    const arn = contract?.spec?.source?.connection?.secretArn;
    if (!arn || !/^arn:aws:secretsmanager:/.test(arn)) {
      return [{ field: "source.connection.secretArn", message: "RDS/MySQL sources must use Secrets Manager ARN" }];
    }
  }
  return [];
}

/**
 * Vaquar Pattern gate for CogniMesh:
 * Rules → Schema → Security patterns → Compliance
 */
function runIntegrityGate(contract, options = {}) {
  const policies = loadPolicies(options.policiesPath);
  const errors = [];
  const warnings = [];
  const passedRules = [];

  for (const rule of policies.rules || []) {
    if (!matchesWhen(contract, rule.when)) continue;

    if (rule.assert) {
      const failures = evaluateAssert(contract, rule.assert);
      if (failures.length) {
        errors.push(...failures.map((f) => ({ ...f, ruleId: rule.id, severity: "error" })));
      } else {
        passedRules.push(rule.id);
      }
    }

    if (rule.warn) {
      const failures = evaluateAssert(contract, rule.warn);
      for (const f of failures) {
        warnings.push({ ...f, ruleId: rule.id, severity: "warning" });
      }
    }
  }

  errors.push(
    ...checkBlockedPatterns(contract, policies.blocked_patterns).map((v) => ({
      ...v,
      ruleId: "blocked_patterns",
      severity: "error",
    }))
  );

  errors.push(
    ...requiresSecretArn(contract).map((v) => ({
      ...v,
      ruleId: "security.secrets_manager",
      severity: "error",
    }))
  );

  return {
    passed: errors.length === 0,
    phase: "Rules → Schema → Security → Compliance",
    pattern: "Vaquar-inspired integrity gate (CogniMesh)",
    checks: ["rules", "blocked_patterns", "secrets_manager"],
    passedRules,
    errors,
    warnings,
  };
}

module.exports = { runIntegrityGate, loadPolicies };
