#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/assets/images"
ICON="$ASSETS/icon.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

swift "$ROOT/scripts/generate-icon.swift" "$ICON"

cp "$ICON" "$ASSETS/android-icon-foreground.png"
cp "$ICON" "$ASSETS/android-icon-monochrome.png"

sips -c 1 1 "$ICON" --out "$TMP/bg-1px.png" >/dev/null
sips -z 1024 1024 "$TMP/bg-1px.png" --out "$ASSETS/android-icon-background.png" >/dev/null

cp "$ICON" "$ASSETS/favicon.png"
sips -z 64 64 "$ASSETS/favicon.png" >/dev/null

IOS_ICON="$ROOT/ios/vPay/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
if [[ -f "$IOS_ICON" ]]; then
  cp "$ICON" "$IOS_ICON"
  echo "Synced iOS AppIcon asset"
fi

if [[ -d "$ROOT/android" ]]; then
  (cd "$ROOT" && npx expo prebuild --platform android --no-install >/dev/null)
  echo "Synced Android launcher assets"
fi

echo "Launcher icons generated"
