# Publishing CogniMesh

Maintainer guide for Docker (GHCR), PyPI, and GitHub Releases.

## Quick publish (CI)

1. Add repository secrets:
   - `PYPI_API_TOKEN` - [PyPI API token](https://pypi.org/manage/account/token/) with upload scope for `cognimesh` (register the name on PyPI first if needed)
2. Create a GitHub **environment** named `pypi` (Settings → Environments) if you want approval gates; optional.
3. Either:
   - **Release:** Create a GitHub Release with tag `v0.1.0` → triggers `.github/workflows/publish.yml`
   - **Manual:** Actions → **Publish** → **Run workflow** → set version and toggles

Published artifacts:

| Artifact | Location |
|----------|----------|
| API image | `ghcr.io/vaquarkhan/cognimesh-api:0.1.0` |
| Portal image (nginx + static) | `ghcr.io/vaquarkhan/cognimesh-portal:0.1.0` |
| Catalog image | `ghcr.io/vaquarkhan/cognimesh-catalog:0.1.0` |
| Python SDK | `pip install cognimesh==0.1.0` |

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
VERSION=0.1.0 node scripts/publish-docker.js
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
| Git tag | `v0.1.0` |

CI syncs Python versions automatically from the release tag or workflow input.

---

## Other artifacts (not automated)

| Component | How to ship |
|-----------|-------------|
| npm monorepo | Private; install from GitHub clone |
| Maven catalog | `mvn deploy` to your registry (`io.cognimesh:catalog-service`) |
| Go runtime | Tag module `github.com/cognimesh/cognitive-runtime` |
| Terraform | Apply from `infra/terraform/environments/prod` |
| Lambda zips | `npm run package:lambda`, `npm run package:domain-writer` |

See [DISTRIBUTION.md](DISTRIBUTION.md) for consumer install instructions.
