# Offline VRP verify (standalone)

**Why this exists:** A signed proof only matters if a skeptical third party can check it **without** CogniMesh API, portal, or catalog. Use this CLI as the trust-network unlock.

## Install / run

From this repo (after `npm install`):

```bash
npx cognimesh-verify path/to/proof.json
# or
node bin/cognimesh-verify.js path/to/proof.json
```

Legacy alias (same verifier): `node scripts/verify-vrp-proof.js path/to/proof.json`

## Signed proofs

```bash
# PEM on disk
cognimesh-verify proof.json --public-key steward.pem --require-signature

# Fetch steward public keys (no private HMAC material is ever published)
cognimesh-verify proof.json --key-url http://localhost:4000/.well-known/cognimesh-steward-keys.json --require-signature
```

### Key distribution

| Endpoint | Purpose |
|----------|---------|
| `GET /.well-known/cognimesh-steward-keys.json` | Public signing-key manifest |
| `GET /api/v1/steward/keys` | Same manifest (authenticated networks / docs) |

Configure publishing:

| Env | Purpose |
|-----|---------|
| `PVDM_STEWARD_PUBLIC_KEY_PEM` | Active steward Ed25519/ECDSA public key PEM |
| `PVDM_STEWARD_PUBLIC_KEY_PATH` | Or path to PEM file |
| `PVDM_STEWARD_PUBLIC_KEY_ID` | keyId advertised in the manifest |
| `PVDM_KEY_EPOCH` | Epoch label (`e1`, …) for rotation |
| `PVDM_STEWARD_KEY_REGISTRY` | Optional JSON file of keys (incl. `status: revoked`) |

**Honesty:** Multiset HMAC keys (`PVDM_STEWARD_VRP_KEY`) stay steward-private. Only **signing** public keys are distributed. Dev-ephemeral proofs often embed `proof.signing.publicKeyPem` — consumers may verify those without the registry.

Rotation / revocation: keep revoked keys in the registry with `status: "revoked"` so old proofs remain auditable; active verify selects non-revoked keys by `keyId` then `epoch`.

## What is checked

Same engine as `lib/vrp/verify.js`: verdict, validity window, signature (when present/required), contract/environment bindings, transform checks as encoded in the proof.

HTTP equivalent (needs API): `POST /api/v1/proofs/verify`

← [Marketplace](MARKETPLACE.md) · [FAQ](FAQ.md)
