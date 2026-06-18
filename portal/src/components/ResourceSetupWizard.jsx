import FormField from "./FormField";
import { tipFor } from "../lib/field-tips";
import {
  PROVISION,
  EXISTING,
  resolveRdsMode,
  resolveSinkMode,
  resolveS3SourceMode,
  rdsWizardSteps,
  sinkWizardSteps,
  s3SourceWizardSteps,
  suggestedS3Location,
  suggestedS3SourceEndpoint,
} from "../lib/resource-provisioning";

function StepProgress({ steps }) {
  const done = steps.filter((s) => s.complete).length;
  return (
    <div className="resource-setup-progress" aria-live="polite">
      <span className="resource-setup-progress-label">
        Setup {done}/{steps.length}
      </span>
      <div className="resource-setup-progress-track">
        {steps.map((s) => (
          <span
            key={s.id}
            className={`resource-setup-progress-dot ${s.complete ? "done" : ""} ${s.optional ? "optional" : ""}`}
            title={`${s.label}: ${s.hint}`}
          />
        ))}
      </div>
    </div>
  );
}

function ModeChoice({ value, onChange, createLabel, createDetail, existingLabel, existingDetail }) {
  return (
    <div className="resource-mode-choices" role="radiogroup">
      <button
        type="button"
        role="radio"
        aria-checked={value === PROVISION}
        className={`resource-mode-card ${value === PROVISION ? "selected" : ""}`}
        onClick={() => onChange(PROVISION)}
      >
        <strong>{createLabel}</strong>
        <span>{createDetail}</span>
        <em className="resource-mode-badge">Recommended</em>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === EXISTING}
        className={`resource-mode-card ${value === EXISTING ? "selected" : ""}`}
        onClick={() => onChange(EXISTING)}
      >
        <strong>{existingLabel}</strong>
        <span>{existingDetail}</span>
      </button>
    </div>
  );
}

export function RdsResourceSetup({ data, onChange, pipelineMeta }) {
  const mode = resolveRdsMode(data);
  const steps = rdsWizardSteps(data);
  const update = onChange;

  return (
    <div className="resource-setup-wizard" data-testid="rds-resource-setup">
      <h3 className="resource-setup-title">Database connection</h3>
      <p className="properties-hint">
        We default to creating secure infrastructure for you. Switch to existing only if the database is already in
        AWS.
      </p>
      <StepProgress steps={steps} />

      <ModeChoice
        value={mode}
        onChange={(rdsProvisioningMode) =>
          update({
            rdsProvisioningMode,
            ...(rdsProvisioningMode === PROVISION ? { secretArn: "", vpcSecurityGroup: "" } : {}),
          })
        }
        createLabel="Create new database"
        createDetail="RDS in private subnets + Secrets Manager — via Terraform on deploy"
        existingLabel="Use my existing database"
        existingDetail="You'll provide Secrets Manager ARN and optional VPC settings"
      />

      <FormField label="Database name" tip={tipFor("source", "database")}>
        <input
          data-testid="rds-database"
          value={data.database || ""}
          onChange={(e) => update({ database: e.target.value })}
          placeholder="orders_db"
        />
      </FormField>
      <FormField label="Table" tip={tipFor("source", "table")}>
        <input
          data-testid="rds-table"
          value={data.table || ""}
          onChange={(e) => update({ table: e.target.value })}
          placeholder="orders"
        />
      </FormField>
      <FormField label="CDC enabled" tip={tipFor("source", "cdcEnabled")}>
        <input
          type="checkbox"
          checked={!!data.cdcEnabled}
          onChange={(e) => update({ cdcEnabled: e.target.checked })}
        />
      </FormField>
      {data.cdcEnabled && (
        <FormField label="Primary key (comma-separated)" tip={tipFor("source", "primaryKey")}>
          <input value={data.primaryKey || ""} onChange={(e) => update({ primaryKey: e.target.value })} />
        </FormField>
      )}

      {mode === PROVISION ? (
        <div className="resource-setup-success">
          <strong>You're on the guided path</strong>
          <p>
            No ARNs needed now. After preview, use <em>Export infrastructure (Terraform)</em> in AWS Design Review.
            Region: <code>{pipelineMeta?.awsRegion || "us-east-1"}</code>
          </p>
        </div>
      ) : (
        <>
          <p className="resource-setup-next">Next: paste ARNs for your existing database</p>
          <FormField label="Secrets Manager ARN" tip="Required for existing databases — never embed passwords">
            <input
              data-testid="rds-secret-arn"
              value={data.secretArn || ""}
              onChange={(e) => update({ secretArn: e.target.value })}
              placeholder="arn:aws:secretsmanager:us-east-1:123456789012:secret:db-creds"
            />
          </FormField>
          <FormField label="VPC security group" tip="Recommended for private RDS">
            <input
              value={data.vpcSecurityGroup || ""}
              onChange={(e) => update({ vpcSecurityGroup: e.target.value })}
              placeholder="sg-0abc123"
            />
          </FormField>
        </>
      )}
    </div>
  );
}

const SINK_ENCRYPTION_OPTIONS = [
  { value: "AES256", label: "AES256 (recommended)" },
  { value: "aws:kms", label: "AWS KMS" },
];

export function SinkResourceSetup({ data, onChange, pipelineMeta }) {
  const mode = resolveSinkMode(data);
  const steps = sinkWizardSteps(data);
  const update = onChange;

  return (
    <div className="resource-setup-wizard" data-testid="sink-resource-setup">
      <h3 className="resource-setup-title">Target storage</h3>
      <StepProgress steps={steps} />

      <ModeChoice
        value={mode}
        onChange={(sinkProvisioningMode) => {
          const patch = { sinkProvisioningMode };
          if (sinkProvisioningMode === PROVISION) {
            patch.encryption = data.encryption || "AES256";
            if (!data.location?.startsWith("s3://")) {
              patch.location = suggestedS3Location(pipelineMeta, data);
            }
          }
          update(patch);
        }}
        createLabel="Create new S3 bucket"
        createDetail="Encrypted gold/curated bucket — Terraform on deploy"
        existingLabel="Use existing bucket"
        existingDetail="Provide the s3:// path you already use"
      />

      <FormField label="S3 location" tip={tipFor("sink", "location")}>
        <input
          data-testid="sink-location"
          value={data.location || ""}
          onChange={(e) => update({ location: e.target.value })}
          placeholder={mode === PROVISION ? suggestedS3Location(pipelineMeta, data) : "s3://your-bucket/prefix/"}
        />
      </FormField>
      {(data.targetType === "iceberg" || data.catalogDatabase) && (
        <>
          <FormField label="Catalog database" tip={tipFor("sink", "catalogDatabase")}>
            <input value={data.catalogDatabase || ""} onChange={(e) => update({ catalogDatabase: e.target.value })} />
          </FormField>
          <FormField label="Catalog table" tip={tipFor("sink", "catalogTable")}>
            <input value={data.catalogTable || ""} onChange={(e) => update({ catalogTable: e.target.value })} />
          </FormField>
        </>
      )}
      <FormField label="Encryption at rest" tip="Enabled automatically when creating new storage">
        <select
          data-testid="sink-encryption"
          value={data.encryption || "AES256"}
          onChange={(e) => update({ encryption: e.target.value })}
        >
          {SINK_ENCRYPTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}

export function S3SourceResourceSetup({ data, onChange, pipelineMeta }) {
  const mode = resolveS3SourceMode(data);
  const steps = s3SourceWizardSteps(data);
  const update = onChange;

  return (
    <div className="resource-setup-wizard" data-testid="s3-source-resource-setup">
      <h3 className="resource-setup-title">S3 landing zone</h3>
      <StepProgress steps={steps} />

      <ModeChoice
        value={mode}
        onChange={(sourceProvisioningMode) => {
          const patch = { sourceProvisioningMode };
          if (sourceProvisioningMode === PROVISION && !data.endpoint?.startsWith("s3://")) {
            patch.endpoint = suggestedS3SourceEndpoint(pipelineMeta);
          }
          update(patch);
        }}
        createLabel="Create new landing bucket"
        createDetail="Terraform provisions encrypted S3 for raw files"
        existingLabel="Use existing bucket"
        existingDetail="Paste your s3:// landing prefix"
      />

      <FormField label="S3 path" tip={tipFor("source", "endpoint")}>
        <input
          data-testid="s3-source-endpoint"
          value={data.endpoint || ""}
          onChange={(e) => update({ endpoint: e.target.value })}
          placeholder={mode === PROVISION ? suggestedS3SourceEndpoint(pipelineMeta) : "s3://bucket/prefix/"}
        />
      </FormField>
    </div>
  );
}
