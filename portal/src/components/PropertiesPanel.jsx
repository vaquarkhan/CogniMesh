import { PIPELINE_META_TIPS, tipFor } from "../lib/field-tips";
import { QUALITY_POLICIES, SCHEMA_EVOLUTION_POLICIES } from "../lib/data-quality-presets";

const SOURCE_TYPES = ["rds", "mysql", "s3", "kafka", "media_url", "api"];
const TRANSFORM_TYPES = ["spark_sql", "glue_etl", "agentic", "passthrough"];
const TARGET_TYPES = ["s3", "iceberg", "redshift", "delta"];
const EXECUTION_MODES = ["batch", "stream"];

function Field({ label, tip, children }) {
  return (
    <label className="field">
      <span className="field-label-row">
        <span>{label}</span>
      </span>
      {children}
      {tip && <p className="field-tip">{tip}</p>}
    </label>
  );
}

export default function PropertiesPanel({ node, onChange, pipelineMeta, onMetaChange }) {
  if (!node) {
    return (
      <aside className="properties">
        <h2>Pipeline settings</h2>
        <p className="properties-intro">
          These apply to the whole pipeline. Click a block on the canvas to edit source, transform, or sink.
        </p>
        <Field label="Name" tip={PIPELINE_META_TIPS.name}>
          <input
            value={pipelineMeta.name}
            onChange={(e) => onMetaChange({ ...pipelineMeta, name: e.target.value })}
            placeholder="customer-orders-cdc"
          />
        </Field>
        <Field label="Domain" tip={PIPELINE_META_TIPS.domain}>
          <input
            value={pipelineMeta.domain}
            onChange={(e) => onMetaChange({ ...pipelineMeta, domain: e.target.value })}
            placeholder="commerce"
          />
        </Field>
        <Field label="Version" tip={PIPELINE_META_TIPS.version}>
          <input
            value={pipelineMeta.version}
            onChange={(e) => onMetaChange({ ...pipelineMeta, version: e.target.value })}
            placeholder="1.0.0"
          />
        </Field>
        <Field label="Schema evolution" tip={PIPELINE_META_TIPS.schemaEvolutionPolicy}>
          <select
            value={pipelineMeta.schemaEvolutionPolicy || "compatible"}
            onChange={(e) => onMetaChange({ ...pipelineMeta, schemaEvolutionPolicy: e.target.value })}
          >
            {SCHEMA_EVOLUTION_POLICIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PII classification" tip={PIPELINE_META_TIPS.piiClassification}>
          <select
            value={pipelineMeta.piiClassification || "medium"}
            onChange={(e) => onMetaChange({ ...pipelineMeta, piiClassification: e.target.value })}
          >
            {["none", "low", "medium", "high", "restricted"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="properties-help-box">
          <strong>Workflow designer</strong>
          <ul>
            <li>Drag <em>Flow</em> blocks: Start, Parallel, Choice, Merge</li>
            <li>Add multiple <em>Sources</em>, <em>Transforms</em>, and <em>Sinks</em></li>
            <li>Connect branches like AWS Step Functions</li>
          </ul>
        </div>
      </aside>
    );
  }

  const d = node.data;
  const update = (patch) => onChange(node.id, patch);
  const bt = d.blockType;

  return (
    <aside className="properties">
      <h2>{d.label}</h2>
      <p className="properties-type">{d.blockType}</p>
      <p className="field-tip block-tip">{tipFor(bt, "_default")}</p>

      <Field label="Display label">
        <input value={d.label} onChange={(e) => update({ label: e.target.value })} />
      </Field>

      {d.blockType === "source" && (
        <>
          <Field label="Source type" tip={tipFor("source", "sourceType")}>
            <select
              value={d.sourceType}
              onChange={(e) => update({ sourceType: e.target.value, detail: e.target.value })}
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          {(d.sourceType === "rds" || d.sourceType === "mysql") && (
            <>
              <Field label="Database" tip={tipFor("source", "database")}>
                <input value={d.database || ""} onChange={(e) => update({ database: e.target.value })} />
              </Field>
              <Field label="Table" tip={tipFor("source", "table")}>
                <input value={d.table || ""} onChange={(e) => update({ table: e.target.value })} />
              </Field>
              <Field label="CDC enabled" tip={tipFor("source", "cdcEnabled")}>
                <input
                  type="checkbox"
                  checked={!!d.cdcEnabled}
                  onChange={(e) => update({ cdcEnabled: e.target.checked })}
                />
              </Field>
              {d.cdcEnabled && (
                <Field label="Primary key (comma-separated)" tip={tipFor("source", "primaryKey")}>
                  <input value={d.primaryKey || ""} onChange={(e) => update({ primaryKey: e.target.value })} />
                </Field>
              )}
            </>
          )}
          {(d.sourceType === "media_url" || d.sourceType === "s3" || d.sourceType === "kafka") && (
            <Field label="Endpoint / path" tip={tipFor("source", "endpoint")}>
              <input
                value={d.endpoint || ""}
                onChange={(e) => update({ endpoint: e.target.value })}
                placeholder="s3://bucket/prefix/ or topic name"
              />
            </Field>
          )}
        </>
      )}

      {d.blockType === "transform" && (
        <>
          <Field label="Transform type" tip={tipFor("transform", "transformType")}>
            <select
              value={d.transformType}
              onChange={(e) => update({ transformType: e.target.value, detail: e.target.value })}
            >
              {TRANSFORM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Execution mode" tip={tipFor("transform", "executionMode")}>
            <select value={d.executionMode || "batch"} onChange={(e) => update({ executionMode: e.target.value })}>
              {EXECUTION_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          {d.transformType === "spark_sql" && (
            <>
              <Field label="Spark SQL" tip={tipFor("transform", "sparkSql")}>
                <textarea rows={5} value={d.sparkSql || ""} onChange={(e) => update({ sparkSql: e.target.value })} />
              </Field>

              <div className="properties-section">
                <h3 className="properties-section-title">Data quality (PVDM)</h3>
                <Field label="SparkRules enabled" tip={tipFor("transform", "sparkRulesEnabled")}>
                  <input
                    type="checkbox"
                    checked={d.sparkRulesEnabled !== false}
                    onChange={(e) => update({ sparkRulesEnabled: e.target.checked })}
                  />
                </Field>
                <Field label="Quality policy" tip={tipFor("transform", "qualityPolicyId")}>
                  <select
                    value={d.qualityPolicyId || "strict-zero-drop"}
                    onChange={(e) => update({ qualityPolicyId: e.target.value, detail: `DQ · ${e.target.value}` })}
                  >
                    {QUALITY_POLICIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="VRP content fields" tip={tipFor("transform", "pvdmContentFields")}>
                  <input
                    value={d.pvdmContentFields || ""}
                    onChange={(e) => update({ pvdmContentFields: e.target.value })}
                    placeholder="order_id, customer_id, total_amount"
                  />
                </Field>
                <Field label="Max null % (content fields)" tip={tipFor("transform", "maxNullPct")}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={d.maxNullPct ?? 100}
                    onChange={(e) => update({ maxNullPct: Number(e.target.value) })}
                  />
                </Field>
              </div>
            </>
          )}
          {d.transformType === "agentic" && (
            <>
              <Field label="Model ID" tip={tipFor("transform", "modelId")}>
                <input value={d.modelId || ""} onChange={(e) => update({ modelId: e.target.value })} />
              </Field>
              <Field label="Prompt template" tip={tipFor("transform", "promptTemplate")}>
                <textarea rows={4} value={d.promptTemplate || ""} onChange={(e) => update({ promptTemplate: e.target.value })} />
              </Field>
              <Field label="Compensation handler" tip={tipFor("transform", "compensationHandler")}>
                <input value={d.compensationHandler || ""} onChange={(e) => update({ compensationHandler: e.target.value })} />
              </Field>
            </>
          )}
        </>
      )}

      {d.blockType === "sink" && (
        <>
          <Field label="Target type" tip={tipFor("sink", "targetType")}>
            <select value={d.targetType} onChange={(e) => update({ targetType: e.target.value, detail: e.target.value })}>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="S3 location" tip={tipFor("sink", "location")}>
            <input value={d.location || ""} onChange={(e) => update({ location: e.target.value })} />
          </Field>
          <Field label="Catalog database" tip={tipFor("sink", "catalogDatabase")}>
            <input value={d.catalogDatabase || ""} onChange={(e) => update({ catalogDatabase: e.target.value })} />
          </Field>
          <Field label="Catalog table" tip={tipFor("sink", "catalogTable")}>
            <input value={d.catalogTable || ""} onChange={(e) => update({ catalogTable: e.target.value })} />
          </Field>
        </>
      )}

      {d.blockType === "parallel" && (
        <Field label="Branches" tip={tipFor("parallel", "branchCount")}>
          <input
            type="number"
            min={2}
            max={5}
            value={d.branchCount || 2}
            onChange={(e) => update({ branchCount: Number(e.target.value) })}
          />
        </Field>
      )}

      {d.blockType === "choice" && (
        <Field label="Default route label" tip={tipFor("choice", "defaultRoute")}>
          <input
            value={d.defaultRoute || "default"}
            onChange={(e) => update({ defaultRoute: e.target.value })}
            placeholder="default"
          />
        </Field>
      )}

      {d.blockType === "map" && (
        <>
          <Field label="Items path" tip={tipFor("map", "itemsPath")}>
            <input value={d.itemsPath || "$.items"} onChange={(e) => update({ itemsPath: e.target.value })} />
          </Field>
          <Field label="Max concurrency" tip={tipFor("map", "maxConcurrency")}>
            <input
              type="number"
              min={1}
              max={100}
              value={d.maxConcurrency || 10}
              onChange={(e) => update({ maxConcurrency: Number(e.target.value) })}
            />
          </Field>
        </>
      )}

      {["start", "merge", "pass", "integrity_gate"].includes(d.blockType) && (
        <p className="field-tip">{tipFor(d.blockType, "_default")}</p>
      )}
    </aside>
  );
}
