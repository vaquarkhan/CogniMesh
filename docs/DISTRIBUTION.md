# CogniMesh distribution

Install and run CogniMesh via Docker, npm, PyPI, Maven, or Go.

## Product image

![CogniMesh](assets/cognimesh-hero.png)

---

## Docker (recommended for local full stack)

### Docker Compose

```bash
git clone https://github.com/vaquarkhan/CogniMesh.git
cd CogniMesh
docker compose up --build
npm run test:docker-smoke   # optional: verify catalog, API, portal
```

| Service | Image (local build) | Port |
|---------|---------------------|------|
| Portal | `cognimesh-portal` | 3000 |
| API | `cognimesh-api` | 4000 |
| Catalog | `cognimesh-catalog` | 8080 |

### Individual images

Build from this repository:

```bash
# API gateway
docker build -f docker/api.Dockerfile -t cognimesh/api:1.0.0 .

# Catalog (Spring Boot)
docker build -f services/catalog/Dockerfile -t cognimesh/catalog:1.0.0 services/catalog

# Portal (Vite dev - local compose)
docker build -f portal/Dockerfile -t cognimesh/portal:1.0.0 portal

# Portal (production - nginx + static, for GHCR)
docker build -f docker/portal.Dockerfile -t cognimesh/portal:1.0.0 .
```

### Published images (target registry)

| Image | Tag | Purpose |
|-------|-----|---------|
| `ghcr.io/vaquarkhan/cognimesh-api` | `1.0.0` | API gateway |
| `ghcr.io/vaquarkhan/cognimesh-portal` | `1.0.0` | Zero-code portal |
| `ghcr.io/vaquarkhan/cognimesh-catalog` | `1.0.0` | Marketplace catalog |

```bash
docker pull ghcr.io/vaquarkhan/cognimesh-api:1.0.0
docker pull ghcr.io/vaquarkhan/cognimesh-portal:1.0.0
docker pull ghcr.io/vaquarkhan/cognimesh-catalog:1.0.0

# Run without building locally
docker compose -f docker-compose.prod.yml up
```

---

## npm (Node.js)

Monorepo root + portal SPA.

```bash
npm install
npm run postinstall   # installs portal dependencies
npm start             # API + portal + catalog (needs Java/Maven for catalog)
npm run dev:minimal   # API + portal only
```

| Package | Path | Description |
|---------|------|-------------|
| `cognimesh` | repository root | API, contract compiler, Vaquar runtime |
| `cognimesh-portal` | `portal/` | React designer (private) |

Scripts:

```bash
npm test
npm run test:unit
npm run docker:up
```

---

## PyPI (Python SDK)

Lightweight client for DataContract YAML and CogniMesh HTTP API.

```bash
pip install cognimesh==1.0.0
```

From source:

```bash
pip install ./python
```

CLI:

```bash
cognimesh validate contracts/examples/structured-cdc-pipeline.yaml
cognimesh health --api http://localhost:4000
cognimesh lineage --api http://localhost:4000
```

Python API:

```python
from cognimesh import CogniMeshClient, load_contract

contract = load_contract("contracts/examples/structured-cdc-pipeline.yaml")
client = CogniMeshClient("http://localhost:4000")
print(client.health())
```

### Related PyPI packages (Vaquar ecosystem)

| Package | Install | Role |
|---------|---------|------|
| [serverless-data-mesh](https://pypi.org/project/serverless-data-mesh/) | `pip install serverless-data-mesh` | Vaquar AWS PVDM runtime (Python) |
| `cognimesh` | `pip install cognimesh` | CogniMesh SDK + CLI (this repo) |

---

## Maven (Java catalog)

```bash
cd services/catalog
mvn test
mvn spring-boot:run
```

Artifact: `io.cognimesh:catalog-service:0.1.0-SNAPSHOT`

---

## Go (cognitive runtime)

```bash
cd services/cognitive-runtime
go test ./...
go run ./cmd/controller
```

Module: `github.com/cognimesh/cognitive-runtime`

---

## Helm / Terraform (production)

```bash
cd infra/terraform/environments/prod
terraform init && terraform apply
```

See [infra/terraform/README.md](../infra/terraform/README.md).

---

## Version matrix

| Component | Version | Registry |
|-----------|---------|----------|
| CogniMesh platform | 1.0.0 | GitHub |
| Python SDK | 1.0.0 | PyPI `cognimesh` |
| npm root | 1.0.0 | GitHub (private monorepo) |
| DataContract schema | v1 | `schemas/data-contract-v1.schema.json` |
