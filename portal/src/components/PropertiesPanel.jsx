import { PIPELINE_META_TIPS, tipFor } from "../lib/field-tips";
import { QUALITY_POLICIES, SCHEMA_EVOLUTION_POLICIES } from "../lib/data-quality-presets";
import { AWS_SERVICES, PROCESSING_MODES } from "../lib/aws-services";
import { SOURCE_TYPES, TRANSFORM_TYPES, TARGET_TYPES, EXECUTION_MODES } from "../lib/block-types";
import { applyProcessingTemplate } from "../lib/processing-templates";
import DataPreviewButton from "./DataPreviewButton";
import BusinessRulesEditor from "./BusinessRulesEditor";

const SINK_ENCRYPTION_OPTIONS = [
  { value: "", label: "Not set (review will flag)" },
  { value: "AES256", label: "AES256 (S3 default)" },
  { value: "aws:kms", label: "AWS KMS" },
];
const AWS_SERVICE_KEYS = Object.keys(AWS_SERVICES);

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

export default function PropertiesPanel({
  node,
  onChange,
  pipelineMeta,
  onMetaChange,
  awsFindings,
  onOpenAwsReview,
  onOpenAwsReviewFinding,
  onApplyFindingFix,
  applyingFindingId,
  token,
  nodes,
  edges,
}) {
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
        <Field
          label="Lake Formation governance"
          tip="Enable LF grants for mesh consumers (recommended when domain is not default)."
        >
          <label className="agent-feature-check pipeline-lf-toggle">
            <input
              type="checkbox"
              data-testid="pipeline-enable-lake-formation"
              checked={Boolean(pipelineMeta.enableLakeFormation)}
              onChange={(e) =>
                onMetaChange({ ...pipelineMeta, enableLakeFormation: e.target.checked })
              }
            />
            <span>Enable Lake Formation for gold tables</span>
          </label>
        </Field>
        {pipelineMeta.meshAccounts && (
          <div className="mesh-accounts-panel">
            <h3>Mesh AWS accounts</h3>
            <p className="properties-hint">Vaquar SDM - producer / steward / publisher (dummy account IDs)</p>
            <ul className="mesh-accounts-list">
              <li><strong>Producer</strong> {pipelineMeta.meshAccounts.producer}</li>
              <li><strong>Steward</strong> {pipelineMeta.meshAccounts.steward}</li>
              <li><strong>Publisher</strong> {pipelineMeta.meshAccounts.publisher}</li>
            </ul>
            {pipelineMeta.awsRegion && (
              <p className="properties-hint">Default region: <strong>{pipelineMeta.awsRegion}</strong></p>
            )}
          </div>
        )}
        <div className="properties-help-box">
          <strong>Workflow designer</strong>
          <ul>
            <li>Drag <em>Flow</em> blocks: Start, Parallel, Choice, Merge</li>
            <li>Add multiple <em>Sources</em>, <em>Transforms</em>, and <em>Sinks</em></li>
            <li>Connect branches like AWS Step Functions</li>
          </ul>
        </div>
        {token && nodes?.length > 0 && (
          <DataPreviewButton token={token} nodes={nodes} edges={edges} pipelineMeta={pipelineMeta} />
        )}
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
      {d.meshAccount && (
        <div className="mesh-node-meta">
          <p className="properties-hint">
            <strong>{d.meshRole || "mesh"}</strong> · AC {d.meshAccount}
            {d.meshRegion ? ` · ${d.meshRegion}` : ""}
            {d.meshDomain ? ` · ${d.meshDomain}` : ""}
          </p>
        </div>
      )}
      {awsFindings?.length > 0 && (
        <div className="props-aws-findings" data-testid="props-aws-findings">
          <div className="props-aws-findings-head">
            <strong>AWS issues on this block ({awsFindings.length})</strong>
          </div>
          <p className="props-aws-findings-hint">
            Fix directly below — opens the design review guide with steps for encryption, Lake Formation, integrity gate, and more.
          </p>
          <ul className="props-aws-findings-list">
            {awsFindings.map((f) => (
              <li key={f.id} className={`props-aws-finding-item sev-${f.severity}`} data-testid={`props-aws-finding-${f.id}`}>
                <div className="props-aws-finding-head">
                  <span className={`sev-pill sev-${f.severity}`}>{f.severity}</span>
                  <span className="props-aws-finding-title">{f.title}</span>
                </div>
                <small className="props-aws-finding-msg">{f.message}</small>
                {f.fix && (
                  <small className="props-aws-finding-fix">
                    <strong>Quick fix:</strong> {f.fix}
                  </small>
                )}
                {(onOpenAwsReviewFinding || onOpenAwsReview) && (
                  <button
                    type="button"
                    className="deploy-btn compact props-aws-fix-btn"
                    data-testid={`props-aws-fix-${f.id}`}
                    onClick={() =>
                      onOpenAwsReviewFinding ? onOpenAwsReviewFinding(f.id) : onOpenAwsReview?.()
                    }
                  >
                    Fix this →
                  </button>
                )}
                {onApplyFindingFix && (
                  <button
                    type="button"
                    className="btn-secondary compact props-aws-apply-btn"
                    data-testid={`props-aws-apply-${f.id}`}
                    disabled={applyingFindingId === f.id}
                    onClick={() => onApplyFindingFix(f)}
                  >
                    {applyingFindingId === f.id ? "Applying…" : "Apply fix"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="field-tip block-tip">{tipFor(bt, "_default")}</p>

      <Field label="Display label">
        <input value={d.label} onChange={(e) => update({ label: e.target.value })} />
      </Field>

      {AWS_SERVICE_KEYS.includes(d.awsService) || ["source", "transform", "sink"].includes(d.blockType) ? (
        <Field label="AWS service" tip="Which AWS service backs this block in your account">
          <select
            value={d.awsService || ""}
            onChange={(e) => {
              const svc = e.target.value;
              const meta = AWS_SERVICES[svc];
              update({ awsService: svc || undefined, detail: meta ? `${meta.icon} ${meta.label}` : d.detail });
            }}
          >
            <option value="">- auto -</option>
            {AWS_SERVICE_KEYS.map((k) => (
              <option key={k} value={k}>
                {AWS_SERVICES[k].icon} {AWS_SERVICES[k].label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {d.blockType === "source" && (
        <>
          <Field label="Source type" tip={tipFor("source", "sourceType")}>
            <select
              value={d.sourceType || SOURCE_TYPES[0]}
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
              <Field label="Secrets Manager ARN" tip="Required for AWS security review - never embed passwords">
                <input
                  value={d.secretArn || ""}
                  onChange={(e) => update({ secretArn: e.target.value })}
                  placeholder="arn:aws:secretsmanager:us-east-1:123456789012:secret:db-creds"
                />
              </Field>
              <Field label="VPC security group (optional)" tip="Private subnet deployment for RDS">
                <input
                  value={d.vpcSecurityGroup || ""}
                  onChange={(e) => update({ vpcSecurityGroup: e.target.value })}
                  placeholder="sg-0abc123"
                />
              </Field>
            </>
          )}
          {(d.sourceType === "media_url" || d.sourceType === "s3" || d.sourceType === "kafka" || d.sourceType === "kinesis") && (
            <Field label="Endpoint / stream / topic" tip={tipFor("source", "endpoint")}>
              <input
                value={d.endpoint || ""}
                onChange={(e) => update({ endpoint: e.target.value })}
                placeholder={d.sourceType === "kinesis" ? "stream-name or ARN" : "s3://bucket/prefix/ or topic"}
              />
            </Field>
          )}
          {token && nodes?.length > 0 && (
            <DataPreviewButton token={token} nodes={nodes} edges={edges} pipelineMeta={pipelineMeta} />
          )}
        </>
      )}

      {d.blockType === "transform" && (
        <>
          <Field label="Processing mode" tip="ETL vs ELT vs enrichment - data architect pattern">
            <select
              value={d.processingMode || "sql"}
              onChange={(e) => {
                const mode = e.target.value;
                const tpl = applyProcessingTemplate(mode);
                update({
                  processingMode: mode,
                  ...tpl,
                  detail: tpl.detail,
                });
              }}
            >
              {PROCESSING_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} - {m.desc}
                </option>
              ))}
            </select>
          </Field>
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
          {(d.transformType === "spark_sql" || d.transformType === "glue_etl" || d.transformType === "glue_streaming") && (
            <>
              <Field label={d.transformType === "glue_etl" ? "Glue script / Spark SQL" : "Spark SQL"} tip={tipFor("transform", "sparkSql")}>
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
                <BusinessRulesEditor
                  rules={d.businessRules || []}
                  onChange={(businessRules) => update({ businessRules })}
                />
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
          <Field
            label="Encryption at rest"
            tip="AES256 or KMS on lakehouse buckets — required by AWS Design Review for S3 targets."
          >
            <select
              data-testid="sink-encryption"
              value={d.encryption || ""}
              onChange={(e) => update({ encryption: e.target.value || undefined })}
            >
              {SINK_ENCRYPTION_OPTIONS.map((opt) => (
                <option key={opt.value || "unset"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
