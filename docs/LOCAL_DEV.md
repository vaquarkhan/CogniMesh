# Local development without Docker Compose

## One-command setup

```bash
npm install          # installs root + portal (postinstall)
cp .env.example .env
npm start            # API + portal + catalog (needs Java 17 + Maven)
```

## API only (no Java required)

Embedded catalog fallback registers products in-memory when Spring catalog is offline:

```bash
npm install
cp .env.example .env
npm run dev:api
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `AUTH_DISABLED` | `true` | Skip Cognito in local dev |
| `CATALOG_FALLBACK` | `embedded` | Use in-memory catalog when :8080 is down |
| `CATALOG_URL` | `http://localhost:8080` | Spring catalog base URL |

## Docker Compose (recommended)

No local Java, Maven, or Vite install required:

```bash
docker compose up --build
# optional verification after services are up:
npm run test:docker-smoke
```

| Service | URL |
|---------|-----|
| Portal | http://localhost:3000 |
| API | http://localhost:4000 |
| Catalog | http://localhost:8080 |

## Tests

```bash
npm test                    # offline unit/e2e (no servers)
npm run dev:api             # terminal 1
npm run test:api            # terminal 2 - SKIPs marketplace if catalog offline
```

`test:api` never fails solely because Spring catalog is down. Deploy + preview always run against the API; marketplace checks SKIP when the catalog is unreachable and embedded fallback has no products yet.

## PowerShell env vars

Use npm scripts (they load `.env` via dotenv) instead of `set VAR=1 && node ...`:

```bash
npm run dev:api
```

Or install [cross-env](https://www.npmjs.com/package/cross-env) via `npm run dev:api` which sets `AUTH_DISABLED=true` explicitly.
