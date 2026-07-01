#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FONT_DIR="node_modules/@fontsource/inter/files"
FONT_FILE="$FONT_DIR/inter-latin-700-normal.woff"
RESVG=(npx --yes @resvg/resvg-js-cli --font-dir "$FONT_DIR" --font-default-family Inter --font-file "$FONT_FILE")

render() {
  local width="$1"
  local input="$2"
  local output="$3"
  "${RESVG[@]}" --fit-width "$width" "$input" "$output"
}

render 32 public/favicon.svg public/favicon-32.png
render 180 public/favicon.svg public/apple-touch-icon.png
render 192 public/favicon.svg public/icon-192.png
render 512 public/favicon.svg public/icon-512.png
render 512 public/icon-maskable.svg public/icon-512-maskable.png

echo "Generated PWA and favicon assets from public/favicon.svg"
