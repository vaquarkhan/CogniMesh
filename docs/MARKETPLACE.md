# Marketplace API

CogniMesh Marketplace is the **consumer discovery plane** for proof-gated data products. This doc covers the dedicated **Marketplace API** (`/api/v1/marketplace/*`) plus recommended high-value features.

Tutorial (UI): [tutorials/proof-gated-marketplace.md](tutorials/proof-gated-marketplace.md)  
Examples: [examples/proof-verify.md](examples/proof-verify.md) · [examples/marketplace-api.md](examples/marketplace-api.md)

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
| `POST` | `/api/v1/marketplace/products/:id/subscription-token` | Mint signed subscription token (approved + VRP PASS) |
| `POST` | `/api/v1/marketplace/products/:id/schema-diff` | Diff schemas (removed cols, type narrowing, nullability) |
| `GET` | `/api/v1/marketplace/featured` | Top trust-ranked **fresh** products (SLA_STALE demoted) |
| `GET` | `/api/v1/marketplace/domains` | Domain facets |
| `GET` | `/api/v1/marketplace/sla` | List SLA subscriptions |
| `POST` | `/api/v1/marketplace/sla` | Subscribe to product freshness SLA (`webhookUrl` optional) |
| `GET` | `/api/v1/marketplace/sla/check` | Check SLA vs last proof; `?notify=true` fires webhooks |
| `GET` | `/.well-known/cognimesh-steward-keys.json` | Steward **signing** public keys for offline verify |

### Trust score rubric (auditable)

Published on `GET /api/v1/marketplace` as `trustRubric` and in code as `TRUST_RUBRIC` (`lib/vrp/product-trust.js`).

| Signal | Points |
|--------|--------|
| VRP PASS (proof-gated) | +40 |
| Profile A or certified T | +20 |
| Profile O | +15 |
| Iceberg snapshot pin | +15 |
| Source snapshot | +15 |
| Schema fingerprint | +10 |
| SLA fresh + PASS | +5 |

**Grades:** A ≥ 80 · B ≥ 55 · C ≥ 30 · D &lt; 30. **Featured** requires score ≥ 55 **and** not `SLA_STALE`.

**B → A example:** `VRP_PASS (40) + PROFILE_A (20) = 60 (B)`. Add `SNAPSHOT_PIN (15) + SCHEMA_BOUND (10) + SLA_FRESH (5) → 90 (A)`.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/products` | Raw catalog list (proxy / embedded) |
| `GET` | `/api/v1/products/:id/consumer-detail` | Schema, samples (fail-closed), trust, Athena link |
| `POST` | `/api/v1/products/:id/access-requests` | Request access |
| `POST` | `/api/v1/access-requests/:id/approve` | Steward approve (+ Lake Formation grant) |
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

### Example: subscription token

```bash
# After steward approve + product has VRP PASS
curl -s -X POST http://localhost:4000/api/v1/marketplace/products/<productId>/subscription-token \
  -H "Content-Type: application/json" -d '{}'
```

Returns a short-lived HMAC token bound to `product_id` + Iceberg snapshot pin + `vrp_verdict: PASS` (not a Cognito JWT). Header: `X-CogniMesh-Subscription-Token`.

**Enforcement:** `POST /api/v1/gateway/serve` (and MCP `/mcp/gateway/serve`) **requires** a valid subscription token when `productId` is set, or when `VRP_REQUIRE_SUBSCRIPTION_TOKEN=true`. Mint alone is not enough — consume paths check the token.

### Example: schema diff

```bash
curl -s -X POST http://localhost:4000/api/v1/marketplace/products/<productId>/schema-diff \
  -H "Content-Type: application/json" \
  -d '{"left":[{"name":"order_id"},{"name":"amount"},{"name":"legacy"}],"right":[{"name":"order_id"},{"name":"amount"}]}'
```

Omit `right` to compare `left` against the product's current manifest schema. **Breaking** when: columns removed, type narrowing / incompatible type change, or nullability tightened (nullable → required). Additive type widens and possible renames are reported separately.

### Example: SLA subscribe + notify

```bash
curl -s -X POST http://localhost:4000/api/v1/marketplace/sla \
  -H "Content-Type: application/json" \
  -d '{"productId":"commerce-orders-gold-1.0.0","slaMinutes":1440,"webhookUrl":"https://hooks.example/sla"}'

curl -s "http://localhost:4000/api/v1/marketplace/sla/check?productId=commerce-orders-gold-1.0.0&notify=true"
```

Without `webhookUrl`, breaches use `ALERT_WEBHOOK_URL` / Teams via `notifySlaBreach`.

### Example: approve with Lake Formation

```bash
curl -s -X POST http://localhost:4000/api/v1/access-requests/<requestId>/approve \
  -H "Content-Type: application/json" \
  -d '{"principalArn":"arn:aws:iam::123456789012:role/DataConsumer"}'
```

| Env | Effect |
|-----|--------|
| `LAKE_FORMATION_GRANT_ENABLED=true` | Live `GrantPermissions` via `@aws-sdk/client-lakeformation` |
| (unset) | **Simulated** grant (local demos stay green) |
| `LAKE_FORMATION_CONSUMER_PRINCIPAL_ARN` | Default principal when body omits `principalArn` |

---

## Honesty boundary

1. **VRP PASS** is required before samples are shown and before subscription tokens mint.
2. Steward **Approve** updates CogniMesh access and attempts LF grant (live only when enabled).
3. SDP / dbt export success does **not** publish to the marketplace by itself.
4. Offline consumers should verify with [`cognimesh-verify`](VERIFY.md) + steward keys — not by trusting the portal alone.
5. Featured listings demote `SLA_STALE` (freshness is a control, not only a badge).

---

## High-value features

### Shipped (this branch)

| Feature | Status |
|---------|--------|
| Trust-ranked search + portal UI | **Shipped** |
| Signed subscription tokens | **Shipped** — mint + **enforced** on gateway/serve when `productId` set |
| Lake Formation grant on approve | **Shipped** — opt-in live / default simulate |
| Contract / schema diff in marketplace | **Shipped** — removed cols, type narrowing, nullability |
| Webhook / notify on SLA stale | **Shipped** — `webhookUrl` + `?notify=true` |
| Featured freshness demotion | **Shipped** — `SLA_STALE` excluded from featured |
| Standalone offline verifier | **Shipped** — `cognimesh-verify` + [VERIFY.md](VERIFY.md) |
| Steward public key distribution | **Shipped** — `/.well-known/cognimesh-steward-keys.json` |

### Next differentiators

| Feature | Why |
|---------|-----|
| **Proof-gated preview rows via gateway** | Samples only through `/gateway/serve` with verified proof (partially there) |
| **Cross-org federated catalog** | Extend `federated-products` with real registry + access request federation |
| **Consumer OpenAPI / MCP tools** | Auto-generate “how to query this product” for agents (Athena SQL + pin) |
| **Billing / chargeback events** | Attach platform billing stubs to marketplace subscribe + query |
| Semantic search | Embeddings over description + schema |
| Certification badges | Beyond Profile A/T/O (SOC2 tag, PII class) |

### Avoid overclaiming

Do **not** position marketplace as replacing Iceberg catalogs or quality tools alone. Lead with: **prove sink == intent at publish, then discover with trust grade**.

---

## Code

- Facade: `lib/marketplace/index.js` · schema diff: `lib/marketplace/schema-diff.js`
- Routes: `lib/marketplace/routes.js`
- Subscription tokens: `lib/vrp/subscription-token.js`
- LF grant: `lib/aws/lake-formation-grant.js`
- SLA: `lib/platform/sla-marketplace.js` · notify: `lib/platform/notifications.js`
- Tests: `lib/__tests__/marketplace.test.js`

← [Documentation map](README.md)
