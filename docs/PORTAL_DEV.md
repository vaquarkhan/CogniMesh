# Portal development guide

Run the CogniMesh zero-code designer without the full Java/Spring stack.

## Quick start (frontend + API)

```bash
npm install
cp .env.example .env
npm run start:dev
```

| URL | Service |
|-----|---------|
| http://localhost:3000 | Portal (Vite) |
| http://localhost:4000 | API gateway |

## Portal only

Terminal 1 — API with embedded catalog:

```bash
npm run dev:api
```

Terminal 2 — Vite dev server:

```bash
npm install --prefix portal   # first time only
npm run dev --prefix portal
```

Set in `.env` or `portal/.env.local`:

```
VITE_API_URL=http://localhost:4000
```

## Production build (catches import errors)

```bash
npm run test:portal
# equivalent: npm run build --prefix portal
```

Output: `portal/dist/` — served in production via CloudFront + S3 (Terraform `portal-cdn` module).

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo canvas change |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+S | Preview YAML |
| Delete | Remove selected block (when focused on canvas) |

## Key files

| File | Role |
|------|------|
| `portal/src/App.jsx` | Canvas, deploy, validation |
| `portal/src/ProtectedApp.jsx` | Auth gate → App |
| `portal/src/components/BlockPalette.jsx` | Draggable blocks |
| `portal/src/lib/api.js` | API client (CSRF via browser Origin) |
| `portal/src/lib/validate-blocks.js` | Inline block validation |

## Troubleshooting

→ [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
