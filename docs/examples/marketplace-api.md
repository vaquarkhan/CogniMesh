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
```

### PowerShell

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/marketplace/products?sort=trust | ConvertTo-Json -Depth 6
```

Full guide: [MARKETPLACE.md](../MARKETPLACE.md) · UI tutorial: [proof-gated-marketplace](../tutorials/proof-gated-marketplace.md)
