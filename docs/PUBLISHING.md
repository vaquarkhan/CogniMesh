# Publishing CogniMesh

Maintainer guide for Docker (GHCR), PyPI, and GitHub Releases.

## Quick publish (CI)

1. **PyPI** — choose one:
   - **Trusted publisher (recommended):** On [pypi.org](https://pypi.org/manage/account/publishing/) add a trusted publisher for `vaquarkhan/CogniMesh`, workflow `publish.yml`, environment `pypi` (optional).
   - **API token:** Repository secret `PYPI_API_TOKEN` — [PyPI API token](https://pypi.org/manage/account/token/) with upload scope for `cognimesh`.
2. Create a GitHub **environment** named `pypi` (Settings → Environments) if you use trusted publishing with environment protection; optional.
3. Either:
   - **Release:** Create a GitHub Release with tag `v1.0.0` → triggers `.github/workflows/publish.yml`
   - **Manual:** Actions → **Publish** → **Run workflow** → set version `1.0.0` and toggles

Published artifacts:

| Artifact | Location |
|----------|----------|
| API image | `ghcr.io/vaquarkhan/cognimesh-api:1.0.0` |
| Portal image (nginx + static) | `ghcr.io/vaquarkhan/cognimesh-portal:1.0.0` |
| Catalog image | `ghcr.io/vaquarkhan/cognimesh-catalog:1.0.0` |
| Python SDK | `pip install cognimesh==1.0.0` |

Run published stack without building locally:

```bash
docker compose -f docker-compose.prod.yml up
```

---

## Local publish - Docker

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
# Token needs write:packages - refresh GitHub CLI if push fails:
#   gh auth refresh -s write:packages
npm run publish:docker
# or with explicit version:
VERSION=1.0.0 node scripts/publish-docker.js
```

Images:

- `docker/api.Dockerfile` - Node API gateway
- `docker/portal.Dockerfile` - Vite production build + nginx (`/api` proxy)
- `services/catalog/Dockerfile` - Spring Boot catalog

Dev compose (`docker-compose.yml`) still builds the Vite **dev** portal from `portal/Dockerfile`. Production pulls use `docker-compose.prod.yml`.

---

## Local publish - PyPI

```bash
pip install build twine
export TWINE_USERNAME=__token__
export TWINE_PASSWORD=pypi-xxxxxxxx
npm run publish:pypi
```

Package lives in `python/` (`cognimesh` on PyPI). Version is synced from root `package.json` unless you pass a version argument.

Test before upload:

```bash
pip install ./python
cognimesh validate contracts/examples/structured-cdc-pipeline.yaml
```

---

## Version bump checklist

Keep these in sync when releasing:

| File | Field |
|------|-------|
| `package.json` | `version` |
| `python/pyproject.toml` | `version` |
| `python/cognimesh/__init__.py` | `__version__` |
| `docker-compose.yml` / `docker-compose.prod.yml` | image tags |
| `README.md` / `docs/DISTRIBUTION.md` | badges and pull tags |
| Git tag | `v1.0.0` |

CI syncs Python versions automatically from the release tag or workflow input.

---

## Other artifacts (not automated)

| Component | How to ship |
|-----------|-------------|
| Maven catalog JAR | `mvn deploy` (configure `distributionManagement`) |
| Go cognitive runtime | Container image or binary release |
| Terraform | Tag + `terraform apply` in target account |
