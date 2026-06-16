# CogniMesh Product Roadmap

**One-sentence summary:** CogniMesh ships the operational and trust layers as MVP APIs and portal UI. Enterprise depth (live JDBC preview, real Bedrock deploy, PDF audit export, cross-org billing) remains on the enhancement path.

See also: [REVIEW.md](../REVIEW.md) (current state) · [PLATFORM_CHECKLIST.md](PLATFORM_CHECKLIST.md) (shipped items)

---

## Implementation status (June 2026)

All 20 roadmap items have **MVP implementations** under `lib/platform/` and portal wiring (`PlatformOperationsPanel`, `platform-api.js`, Agent Builder deploy, data preview, DQ rules editor).

| Tier | Items | MVP status | Notes |
|------|-------|------------|-------|
| 1 | Live dashboard, agent deploy, data preview, versioning, notifications | **Shipped** | Simulated preview/agent deploy unless env flags set |
| 2 | Health score, impact, cost, access, audit | **Shipped** | Audit is Markdown JSON; PDF export future |
| 3 | NL pipelines, column lineage, self-heal, multi-cloud, federated mesh | **Shipped** | NL via AI Builder; self-heal API at `/platform/self-heal` |
| 4 | Plugins, copilot, DQ editor, SLA marketplace, open spec | **Shipped** | Copilot is rule-based; plugins in-memory registry |

**API surface:** `mountPlatformRoutes()` in `lib/platform/index.js` — `/api/v1/platform/*` and `/api/v1/agents/deploy`.

**Portal:** Header **Operations** panel · Deploy confirm shows **impact analysis** · Source **Preview 10 rows** · Transform **business rules** · Agent **Deploy to AWS**.

---

## Tier 1 — Makes people say "I need this" (Month 1–2)

| # | Feature | Why it matters | Current state |
|---|---------|----------------|---------------|
| 1 | **Live pipeline execution dashboard** | Operators need running / succeeded / failed per pipeline in real time. | **MVP:** `GET /api/v1/platform/dashboard` + Operations → Live ops (15s refresh) |
| 2 | **One-click Bedrock Agent deploy** | Closes design → production loop. | **MVP:** `POST /api/v1/agents/deploy` + Agent Builder **Deploy to AWS** (simulated unless `AWS_AGENT_DEPLOY_ENABLED=true`) |
| 3 | **Data preview in portal** | Prove source connection before deploy. | **MVP:** `POST /api/v1/platform/preview-source` + Properties panel button (simulated unless `DATA_PREVIEW_LIVE=true`) |
| 4 | **Pipeline versioning + rollback** | Roll back canvas + contract after bad deploy. | **MVP:** in-memory versions on deploy + Operations → Versions → Rollback |
| 5 | **Notifications (Slack / Teams / email)** | Webhooks on failure / SLA breach. | **MVP:** `lib/platform/notifications.js` + deploy failure hook; config in Operations → Alerts |

---

## Tier 2 — Makes enterprise buyers sign checks (Month 2–4)

| # | Feature | What it unlocks | Current state |
|---|---------|----------------|---------------|
| 6 | **Data Product Health Score** | Executive 0–100 score per product. | **MVP:** `GET /api/v1/platform/health` + Operations → Health |
| 7 | **Impact Analysis** | Downstream blast radius before deploy. | **MVP:** `POST /api/v1/platform/impact` + Deploy confirm modal |
| 8 | **Cost dashboard** | Per-pipeline cost attribution. | **MVP:** `GET /api/v1/platform/costs` + Operations → Cost |
| 9 | **Self-service consumer access** | Request → approve → grant. | **Existing:** marketplace + steward approvals; federated list in Operations |
| 10 | **Audit report generator** | Compliance export. | **MVP:** `GET /api/v1/platform/audit-report` (Markdown in Operations → Audit) |

---

## Tier 3 — Makes competitors nervous (Month 4–6)

| # | Feature | Why it's a moat | Current state |
|---|---------|-----------------|---------------|
| 11 | **Natural language pipeline creation** | Intent → canvas. | **Existing:** AI Builder in DesignerSidebar (local rules) |
| 12 | **Column-level lineage** | Click column → upstream/downstream. | **MVP:** `POST /api/v1/platform/column-lineage` + Operations → Columns |
| 13 | **Self-healing pipelines** | VRP fail → auto re-ingest. | **MVP:** `POST /api/v1/platform/self-heal` (PVDM runtime integration) |
| 14 | **Multi-cloud** | AWS + Databricks + GCP targets. | **MVP:** `GET /api/v1/platform/deploy-targets` + compile-target API |
| 15 | **Federated mesh marketplace** | Cross-org discovery. | **MVP:** `GET /api/v1/platform/federated-products` |

---

## Tier 4 — Makes it the platform standard (Year 2)

| # | Feature | End state | Current state |
|---|---------|-----------|---------------|
| 16 | **Plugin system (custom blocks)** | Teams add blocks without forking | **MVP:** `GET/POST /api/v1/platform/plugins` |
| 17 | **Embedded AI copilot** | Debug failures in chat | **MVP:** `POST /api/v1/platform/copilot` (rule-based responses) |
| 18 | **Visual data quality rules editor** | Business rules beyond schema | **MVP:** `BusinessRulesEditor` + `POST /api/v1/platform/dq/validate` |
| 19 | **SLA marketplace** | Producer-bound SLAs + alerts | **MVP:** `GET/POST /api/v1/platform/sla` |
| 20 | **Open DataContract standard** | `cognimesh.io/v1` reference | **MVP:** `GET /api/v1/platform/open-spec` |

---

## Enhancement path (post-MVP)

```
✅ Persistent version store (file) · Contract diff · Deploy approval workflow
✅ Live S3/local file preview · Self-heal UI · Audit markdown download
JDBC/Athena sampling · Real Bedrock KB/guardrails/tools · PDF audit export
Copilot with LLM backend · Plugin sandbox · Cross-org billing
```

### Technical anchors

| Feature | Code |
|---------|------|
| Platform routes | `lib/platform/index.js` |
| Portal UI | `portal/src/components/PlatformOperationsPanel.jsx` |
| Agent deploy | `lib/platform/agent-deploy.js` |
| Versioning | `lib/platform/pipeline-versions.js` |

---

## Positioning

| Stage | Score | What you have |
|-------|-------|---------------|
| Pipeline engine | 10/10 | Deploy path proven, CI green |
| Operational layer | MVP | Dashboard, versions, notifications, preview |
| Trust layer | MVP | Health, impact, cost, audit |
| Platform moat | MVP | Lineage, multi-cloud targets, federated catalog, plugins, SLA |
