const SOURCE_TYPES = ["rds", "mysql", "s3", "kafka", "media_url", "api"];
const TRANSFORM_TYPES = ["spark_sql", "glue_etl", "agentic", "passthrough"];
const TARGET_TYPES = ["s3", "iceberg", "redshift", "delta"];
const EXECUTION_MODES = ["batch", "stream"];

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function PropertiesPanel({ node, onChange, pipelineMeta, onMetaChange }) {
  if (!node) {
    return (
      <aside className="properties">
        <h2>Pipeline</h2>
        <Field label="Name">
          <input
            value={pipelineMeta.name}
            onChange={(e) => onMetaChange({ ...pipelineMeta, name: e.target.value })}
            placeholder="my-pipeline"
          />
        </Field>
        <Field label="Domain">
          <input
            value={pipelineMeta.domain}
            onChange={(e) => onMetaChange({ ...pipelineMeta, domain: e.target.value })}
            placeholder="commerce"
          />
        </Field>
        <Field label="Version">
          <input
            value={pipelineMeta.version}
            onChange={(e) => onMetaChange({ ...pipelineMeta, version: e.target.value })}
            placeholder="1.0.0"
          />
        </Field>
        <p className="properties-hint">Select a block to edit its configuration</p>
      </aside>
    );
  }

  const d = node.data;
  const update = (patch) => onChange(node.id, patch);

  return (
    <aside className="properties">
      <h2>{d.label}</h2>
      <p className="properties-type">{d.blockType}</p>

      <Field label="Label">
        <input value={d.label} onChange={(e) => update({ label: e.target.value })} />
      </Field>

      {d.blockType === "source" && (
        <>
          <Field label="Source type">
            <select value={d.sourceType} onChange={(e) => update({ sourceType: e.target.value, detail: e.target.value })}>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          {(d.sourceType === "rds" || d.sourceType === "mysql") && (
            <>
              <Field label="Database">
                <input value={d.database || ""} onChange={(e) => update({ database: e.target.value })} />
              </Field>
              <Field label="Table">
                <input value={d.table || ""} onChange={(e) => update({ table: e.target.value })} />
              </Field>
              <Field label="CDC enabled">
                <input type="checkbox" checked={!!d.cdcEnabled} onChange={(e) => update({ cdcEnabled: e.target.checked })} />
              </Field>
              {d.cdcEnabled && (
                <Field label="Primary key (comma-separated)">
                  <input value={d.primaryKey || ""} onChange={(e) => update({ primaryKey: e.target.value })} />
                </Field>
              )}
            </>
          )}
          {d.sourceType === "media_url" && (
            <Field label="Ingest endpoint">
              <input value={d.endpoint || ""} onChange={(e) => update({ endpoint: e.target.value })} placeholder="s3://bucket/raw/" />
            </Field>
          )}
        </>
      )}

      {d.blockType === "transform" && (
        <>
          <Field label="Transform type">
            <select
              value={d.transformType}
              onChange={(e) => update({ transformType: e.target.value, detail: e.target.value })}
            >
              {TRANSFORM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Execution mode">
            <select value={d.executionMode || "batch"} onChange={(e) => update({ executionMode: e.target.value })}>
              {EXECUTION_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          {d.transformType === "spark_sql" && (
            <Field label="Spark SQL">
              <textarea rows={4} value={d.sparkSql || ""} onChange={(e) => update({ sparkSql: e.target.value })} />
            </Field>
          )}
          {d.transformType === "agentic" && (
            <>
              <Field label="Model ID">
                <input value={d.modelId || ""} onChange={(e) => update({ modelId: e.target.value })} />
              </Field>
              <Field label="Prompt template">
                <textarea rows={3} value={d.promptTemplate || ""} onChange={(e) => update({ promptTemplate: e.target.value })} />
              </Field>
              <Field label="Compensation handler">
                <input value={d.compensationHandler || ""} onChange={(e) => update({ compensationHandler: e.target.value })} />
              </Field>
            </>
          )}
        </>
      )}

      {d.blockType === "sink" && (
        <>
          <Field label="Target type">
            <select value={d.targetType} onChange={(e) => update({ targetType: e.target.value, detail: e.target.value })}>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="S3 location">
            <input value={d.location || ""} onChange={(e) => update({ location: e.target.value })} />
          </Field>
          <Field label="Catalog database">
            <input value={d.catalogDatabase || ""} onChange={(e) => update({ catalogDatabase: e.target.value })} />
          </Field>
          <Field label="Catalog table">
            <input value={d.catalogTable || ""} onChange={(e) => update({ catalogTable: e.target.value })} />
          </Field>
        </>
      )}
    </aside>
  );
}
