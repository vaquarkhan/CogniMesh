# Example: Marketplace API

Search and rank proof-gated products. Prefer these routes over raw `/api/v1/products` when you need trust filters.

```bash
# Catalog of marketplace routes
curl -s http://localhost:4000/api/v1/marketplace

# Trust-ranked search
curl -s "http://localhost:4000/api/v1/marketplace/products?sort=trust&proofGated=true&limit=10"

# Featured
curl -s http://localhost:4000/api/v1/marketplace/featured

# Domains
curl -s http://localhost:4000/api/v1/marketplace/domains

# Product card
curl -s http://localhost:4000/api/v1/marketplace/products/<productId>

# Schema diff (omit right → compare left to current product schema)
curl -s -X POST http://localhost:4000/api/v1/marketplace/products/<productId>/schema-diff \
  -H "Content-Type: application/json" \
  -d '{"left":[{"name":"order_id"},{"name":"amount"},{"name":"legacy"}]}'

# Subscription token (requires approved access + VRP PASS)
curl -s -X POST http://localhost:4000/api/v1/marketplace/products/<productId>/subscription-token \
  -H "Content-Type: application/json" -d '{}'

# SLA subscribe with optional webhook
curl -s -X POST http://localhost:4000/api/v1/marketplace/sla \
  -H "Content-Type: application/json" \
  -d '{"productId":"<productId>","slaMinutes":1440,"webhookUrl":"https://hooks.example/sla"}'

# Check SLA and notify on breach
curl -s "http://localhost:4000/api/v1/marketplace/sla/check?productId=<productId>&notify=true"

# Approve access (+ Lake Formation grant; simulated unless LAKE_FORMATION_GRANT_ENABLED=true)
curl -s -X POST http://localhost:4000/api/v1/access-requests/<requestId>/approve \
  -H "Content-Type: application/json" \
  -d '{"principalArn":"arn:aws:iam::123456789012:role/DataConsumer"}'
```

### PowerShell

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/marketplace/products?sort=trust | ConvertTo-Json -Depth 6
```

Full guide: [MARKETPLACE.md](../MARKETPLACE.md) · UI tutorial: [proof-gated-marketplace](../tutorials/proof-gated-marketplace.md)
