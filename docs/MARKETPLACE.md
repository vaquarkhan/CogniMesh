# Marketplace API

CogniMesh Marketplace is the **consumer discovery plane** for proof-gated data products. This doc covers the dedicated **Marketplace API** (`/api/v1/marketplace/*`) plus recommended high-value features.

Tutorial (UI): [tutorials/proof-gated-marketplace.md](tutorials/proof-gated-marketplace.md)  
Examples: [examples/proof-verify.md](examples/proof-verify.md)

---

## Quick start

```bash
npm run start:dev
# AUTH_DISABLED=true by default

curl -s http://localhost:4000/api/v1/marketplace | jq .
curl -s "http://localhost:4000/api/v1/marketplace/products?sort=trust&proofGated=true" | jq .
curl -s http://localhost:4000/api/v1/marketplace/featured | jq .
```

Deploy a Vaquar / medallion pattern first so products exist in the catalog.

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/marketplace` | API catalog (routes + honesty notes) |
| `GET` | `/api/v1/marketplace/products` | Search / filter / sort |
| `GET` | `/api/v1/marketplace/products/:id` | Product card + consumer actions |
| `GET` | `/api/v1/marketplace/featured` | Top trust-ranked products |
| `GET` | `/api/v1/marketplace/domains` | Domain facets |
| `GET` | `/api/v1/marketplace/sla` | List SLA subscriptions |
| `POST` | `/api/v1/marketplace/sla` | Subscribe to product freshness SLA |
| `GET` | `/api/v1/marketplace/sla/check` | Check SLA vs last run |

### Related product / proof APIs (already shipped)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/products` | Raw catalog list (proxy / embedded) |
| `GET` | `/api/v1/products/:id/consumer-detail` | Schema, samples (fail-closed), trust, Athena link |
| `POST` | `/api/v1/products/:id/access-requests` | Request access |
| `POST` | `/api/v1/access-requests/:id/approve` | Steward approve |
| `POST` | `/api/v1/proofs/verify` | Offline VRP verify |
| `POST` | `/api/v1/proofs/diff` | Diff two proofs |

### Search query params

| Param | Example | Effect |
|-------|---------|--------|
| `q` | `orders` | Name / domain / description / badges |
| `domain` | `commerce` | Exact domain |
| `grade` | `A` | Trust grade A–D |
| `proofGated` | `true` | Only proof-gated products |
| `fresh` | `true` | Only within proof SLA window |
| `sort` | `trust` \| `name` \| `domain` \| `fresh` | Default `trust` |
| `limit` / `offset` | `20` / `0` | Pagination |

### Example: subscribe SLA

```bash
curl -s -X POST http://localhost:4000/api/v1/marketplace/sla \
  -H "Content-Type: application/json" \
  -d '{"productId":"commerce-orders-gold-1.0.0","slaMinutes":1440,"penalty":"credit"}'
```

---

## Honesty boundary

1. **VRP PASS** is required before samples are shown and before you should treat a listing as trustworthy.
2. Steward **Approve** updates CogniMesh access state; **Lake Formation GrantPermissions is not auto-called yet**.
3. SDP / dbt export success does **not** publish to the marketplace by itself.

---

## High-value features (roadmap advice)

Prioritized for differentiation vs OpenMetadata / DataHub / Polaris / Unity / Atlan:

### Ship next (highest ROI)

| Feature | Why it wins | Effort |
|---------|-------------|--------|
| **1. Signed subscription tokens** | Consumers get a short-lived token bound to product + snapshot pin + VRP PASS; agents/MCP use it instead of raw IAM | M |
| **2. Live LF grant on approve** | Close the “approve but still no Athena” gap - call Lake Formation `GrantPermissions` when steward approves | M |
| **3. Contract / schema diff in marketplace** | Show what changed between versions (breaking columns) next to proof diff | S–M |
| **4. Trust-ranked search in portal UI** | ~~Wire Marketplace panel to `/marketplace/products?sort=trust`~~ **Shipped** (search + proof-gated filter) | done |
| **5. Webhook / notify on SLA stale** | Alert consumers when proof freshness breaches - pairs with existing SLA subscribe | S |

### Strong differentiators (quarter)

| Feature | Why |
|---------|-----|
| **Proof-gated preview rows via gateway** | Samples only through `/gateway/serve` with verified proof (already partially there) |
| **Cross-org federated catalog** | Extend `federated-products` with real registry + access request federation |
| **Consumer OpenAPI / MCP tools** | Auto-generate “how to query this product” for agents (Athena SQL + pin) |
| **Billing / chargeback events** | Already have platform billing stubs - attach to marketplace subscribe + query |

### Nice-to-have later

- Semantic search (embeddings over description + schema)
- Certification badges beyond Profile A/T/O (SOC2 tag, PII class)
- Public (unauthenticated) read-only catalog of **metadata only** (never samples)

### Avoid overclaiming

Do **not** position marketplace as replacing Iceberg catalogs or quality tools alone. Lead with: **prove sink == intent at publish, then discover with trust grade**.

---

## Code

- Facade: `lib/marketplace/index.js`
- Routes: `lib/marketplace/routes.js` (mounted from `services/api-gateway/server.js`)
- Trust: `lib/vrp/product-trust.js` · SLA: `lib/vrp/proof-sla.js`
- Tests: `lib/__tests__/marketplace.test.js`

← [Documentation map](README.md)
