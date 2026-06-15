#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/infra/terraform/build/integrity-gate.zip"
mkdir -p "$(dirname "$OUT")"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

cp -r "$ROOT/services/lambda/integrity-gate/"* "$WORKDIR/"
cp -r "$ROOT/lib" "$WORKDIR/lib"
cp -r "$ROOT/rules" "$WORKDIR/rules"
cp -r "$ROOT/schemas" "$WORKDIR/schemas"
mkdir -p "$WORKDIR/services/pipeline-engine"
cp "$ROOT/services/pipeline-engine/compile.js" "$WORKDIR/services/pipeline-engine/"

cd "$WORKDIR"
npm install --omit=dev 2>/dev/null || npm install --omit=dev
zip -r "$OUT" . -x "*.git*"
echo "Built $OUT"
