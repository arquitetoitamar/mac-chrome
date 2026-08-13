#!/usr/bin/env bash
# Gera o pacote .zip para envio à Chrome Web Store.
# Inclui só o que a extensão precisa em runtime — docs, git e assets de
# marketing ficam de fora (pacote menor = menos superfície de revisão).
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(grep -m1 '"version"' manifest.json | sed -E 's/.*"version"[^"]*"([^"]+)".*/\1/')
OUT="dist/mc-analise-produtos-${VERSION}.zip"

rm -rf dist
mkdir -p dist

zip -r -q "$OUT" \
  manifest.json \
  background.js \
  lib \
  content \
  popup \
  options \
  icons \
  -x '*.DS_Store' '*/.*' '*.svg'

echo "Pacote: $OUT"
unzip -l "$OUT" | tail -n 1
echo
echo "Confira antes de enviar:"
echo "  unzip -l $OUT"
