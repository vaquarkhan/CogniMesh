"use strict";

const RULE_TYPES = [
  { id: "not_null", label: "Not null", needsValue: false },
  { id: "gt_zero", label: "Greater than zero", needsValue: false },
  { id: "no_future_dates", label: "No future dates", needsValue: false },
  { id: "regex", label: "Regex match", needsValue: true },
  { id: "range", label: "Numeric range", needsValue: true },
];

function validateBusinessRules(rules = []) {
  const errors = [];
  const validated = [];
  for (const rule of rules) {
    if (!rule.column) {
      errors.push("Each rule needs a column");
      continue;
    }
    if (!rule.type) {
      errors.push(`Rule on ${rule.column} needs a type`);
      continue;
    }
    if (rule.type === "regex" && !rule.value) {
      errors.push(`Regex rule on ${rule.column} needs a pattern`);
      continue;
    }
    if (rule.type === "range" && (rule.min == null || rule.max == null)) {
      errors.push(`Range rule on ${rule.column} needs min and max`);
      continue;
    }
    validated.push(rule);
  }
  return { valid: errors.length === 0, errors, rules: validated };
}

function rulesToSparkExpressions(rules = []) {
  return rules.map((r) => {
    switch (r.type) {
      case "not_null":
        return `${r.column} IS NOT NULL`;
      case "gt_zero":
        return `${r.column} > 0`;
      case "no_future_dates":
        return `${r.column} <= current_timestamp()`;
      case "regex":
        return `${r.column} RLIKE '${String(r.value).replace(/'/g, "''")}'`;
      case "range":
        return `${r.column} BETWEEN ${r.min} AND ${r.max}`;
      default:
        return `${r.column} IS NOT NULL`;
    }
  });
}

module.exports = { RULE_TYPES, validateBusinessRules, rulesToSparkExpressions };
