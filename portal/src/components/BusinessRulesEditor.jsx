const RULE_PRESETS = [
  { id: "not_null", label: "Not null" },
  { id: "gt_zero", label: "> 0" },
  { id: "no_future_dates", label: "No future dates" },
  { id: "regex", label: "Regex" },
  { id: "range", label: "Range" },
];

export default function BusinessRulesEditor({ rules = [], onChange }) {
  const addRule = () => {
    onChange([...rules, { column: "", type: "not_null" }]);
  };

  const updateRule = (idx, patch) => {
    const next = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const removeRule = (idx) => {
    onChange(rules.filter((_, i) => i !== idx));
  };

  return (
    <div className="dq-rules-editor">
      <h4>Business rules</h4>
      <p className="properties-hint">Beyond schema: revenue &gt; 0, no future dates, etc.</p>
      {rules.map((rule, idx) => (
        <div key={idx} className="dq-rule-row">
          <input
            placeholder="column"
            value={rule.column || ""}
            onChange={(e) => updateRule(idx, { column: e.target.value })}
          />
          <select value={rule.type || "not_null"} onChange={(e) => updateRule(idx, { type: e.target.value })}>
            {RULE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {rule.type === "regex" && (
            <input
              placeholder="pattern"
              value={rule.value || ""}
              onChange={(e) => updateRule(idx, { value: e.target.value })}
            />
          )}
          {rule.type === "range" && (
            <>
              <input
                type="number"
                placeholder="min"
                value={rule.min ?? ""}
                onChange={(e) => updateRule(idx, { min: Number(e.target.value) })}
              />
              <input
                type="number"
                placeholder="max"
                value={rule.max ?? ""}
                onChange={(e) => updateRule(idx, { max: Number(e.target.value) })}
              />
            </>
          )}
          <button type="button" className="btn-secondary" onClick={() => removeRule(idx)}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={addRule}>Add rule</button>
    </div>
  );
}
