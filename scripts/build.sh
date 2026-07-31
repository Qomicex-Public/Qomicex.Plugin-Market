#!/bin/sh
set -e
SRCDIR="$(realpath "$(dirname "$0")/..")"
NAME="$(basename "$SRCDIR")"
cd "$SRCDIR"

node scripts/seed-catalog.mjs
npx tsc && npx vite build
node scripts/seed-catalog.mjs --copy-only

OUTDIR="$SRCDIR/dist/pkg"
mkdir -p "$OUTDIR"
zip -r "$OUTDIR/${NAME}.qplugin" \
  manifest.json dist/ \
  -x "dist/pkg/*" -x ".git/*"

echo "已打包: $OUTDIR/${NAME}.qplugin"
