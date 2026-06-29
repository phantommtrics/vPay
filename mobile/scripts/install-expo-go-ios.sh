#!/usr/bin/env bash
set -euo pipefail

# Expo Go for SDK 53 (Expo 53.x)
EXPO_GO_VERSION="Expo-Go-2.33.17"
URL="https://github.com/expo/expo-go-releases/releases/download/${EXPO_GO_VERSION}/${EXPO_GO_VERSION}.tar.gz"
CACHE_DIR="$HOME/.expo/ios-simulator-app-cache"
APP_DIR="$CACHE_DIR/${EXPO_GO_VERSION}.app"
ARCHIVE="$CACHE_DIR/${EXPO_GO_VERSION}.tar.gz"

mkdir -p "$CACHE_DIR"

if [[ -d "$APP_DIR" ]]; then
  echo "Expo Go already cached at $APP_DIR"
else
  echo "Downloading Expo Go (~59 MB). This can take several minutes on slow networks..."
  curl -L --http1.1 --retry 5 --retry-delay 3 --continue-at - -o "$ARCHIVE" "$URL"
  echo "Extracting..."
  tar -xzf "$ARCHIVE" -C "$CACHE_DIR"
  rm -f "$ARCHIVE"
fi

if ! xcrun simctl list devices booted | grep -q Booted; then
  echo "No booted iOS simulator found. Open Simulator first, then rerun this script."
  exit 1
fi

echo "Installing Expo Go on booted simulator..."
xcrun simctl install booted "$APP_DIR"
echo "Done. Start the app with: npx expo start --ios --localhost"
