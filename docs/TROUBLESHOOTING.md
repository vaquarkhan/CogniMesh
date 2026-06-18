# Troubleshooting CogniMesh

Common local dev errors and fixes.

## Portal does not load / Vite import error

**Symptom:** `Failed to resolve import "../auth/AuthContext" from ProtectedApp.jsx`

**Fix:** Import paths in `portal/src/ProtectedApp.jsx` must use `./` (same folder as `src/`), not `../`:

```javascript
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/Login";
import App from "./App";
```

Run `npm run test:portal` to catch this in CI before merge.

---

## `npm start` fails - vite not found / portal deps missing

**Symptom:** `Cannot find module 'vite'` or portal won't start.

**Cause:** Root `npm install` must install portal dependencies via postinstall.

**Fix:**

```bash
npm install          # runs scripts/postinstall.js → portal npm install
npm run start:dev    # recommended: API + portal, no Java
```

If postinstall was skipped: `npm install --prefix portal`

---

## API `/health` returns 503

**Symptom:** `status: degraded` when Spring catalog is not running.

**Fix:** Use in-memory catalog (no Java required):

```bash
cp .env.example .env
# Ensure these are set:
# AUTH_DISABLED=true
# CATALOG_STORAGE=memory
npm run dev:api
```

Health should return `200` with `catalog.storage: "embedded"`.

**Do not** use PowerShell `set AUTH_DISABLED=true` - it does not apply to npm child processes. Use `.env` + npm scripts.

---

## PowerShell environment variables do not work

**Symptom:** `set VAR=value && npm start` has no effect on Windows.

**Fix:** Copy `.env.example` to `.env` and use:

```bash
npm run start:dev
npm run dev:api
npm run dev:minimal
```

---

## Java / Maven required for full stack

**Symptom:** `mvn` not found when running `npm start`.

**Fix:** Use one of:

```bash
npm run start:dev       # API + portal only (embedded catalog)
npm run docker:up       # full stack in Docker
```

---

## Port already in use (8080 / 4000 / 3000)

**Symptom:** `bind: address already in use`

**Fix:**

```bash
docker compose down
# Or stop the process using the port, then:
docker compose up --build
```

---

## API E2E `UV_HANDLE_CLOSING` on exit

**Symptom:** Node assertion on process exit after `npm run test:api`.

**Fix:** Updated `scripts/test-api-e2e.js` destroys HTTP agents before exit. Upgrade to latest repo and re-run.

---

## CSRF 403 on deploy from portal

**Symptom:** `CSRF check failed: invalid or missing Origin`

**Fix:** Open portal at `http://localhost:3000` (must match `CORS_ORIGINS` in `.env`). For local dev, keep `AUTH_DISABLED=true`.

---

## VRP / proof tests fail on digest_type (full_file vs parquet_footer)

**Symptom:** `test:vrp-security` fails comparing `full_file` vs `parquet_footer` digests.

**Cause:** Shell still has `VRP_FORCE_NDJSON=true` from an earlier test or debug session (not a code regression).

**Fix:**

```powershell
Remove-Item Env:VRP_FORCE_NDJSON -ErrorAction SilentlyContinue
```

```bash
unset VRP_FORCE_NDJSON
```

Then re-run `npm run test:vrp-security`. See [veridata-integration.md](veridata-integration.md#testing-note-vrp_force_ndjson).

---

## Still stuck?

See **[FAQ.md](FAQ.md)** for proof, PASS/FAIL, steward, and agent questions.

1. `npm run test:unit && npm test`
2. `npm run test:portal`
3. See [LOCAL_DEV.md](LOCAL_DEV.md) and [PORTAL_DEV.md](PORTAL_DEV.md)
