#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

resolve_android_sdk() {
  if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
    echo "$ANDROID_HOME"
    return 0
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT" ]]; then
    echo "$ANDROID_SDK_ROOT"
    return 0
  fi
  if [[ -d "$HOME/Library/Android/sdk" ]]; then
    echo "$HOME/Library/Android/sdk"
    return 0
  fi
  return 1
}

if [[ "$(uname -s)" == "Darwin" ]]; then
  if /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
  elif /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home)"
  fi
fi

if [[ -z "${JAVA_HOME:-}" || ! -d "$JAVA_HOME" ]]; then
  echo "JAVA_HOME is not set. Install JDK 17 and export JAVA_HOME."
  exit 1
fi

if ! ANDROID_SDK="$(resolve_android_sdk)"; then
  echo "Android SDK not found. Install Android Studio or set ANDROID_HOME."
  exit 1
fi

export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_SDK_ROOT="$ANDROID_SDK"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

printf 'sdk.dir=%s\n' "$ANDROID_SDK" > "$ROOT/android/local.properties"

KEYSTORE_PROPS="$ROOT/android-signing/keystore.properties"
KEYSTORE_FILE="$ROOT/android-signing/vpay-upload.keystore"

if [[ ! -f "$KEYSTORE_FILE" || ! -f "$KEYSTORE_PROPS" ]]; then
  echo "Release signing not configured. Run: npm run setup:play-upload-key"
  exit 1
fi

if grep -q 'YOUR_STORE_PASSWORD\|YOUR_KEY_PASSWORD' "$KEYSTORE_PROPS"; then
  echo "Edit android-signing/keystore.properties with your real passwords."
  exit 1
fi

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  echo "Warning: EXPO_PUBLIC_API_URL is not set."
  echo "The APK will install, but API calls may fail on a physical device."
  echo "Add to mobile/.env before building, e.g.:"
  echo "  EXPO_PUBLIC_API_URL=http://192.168.1.100:3001"
  echo
fi

echo "Using JAVA_HOME=$JAVA_HOME"
echo "Using ANDROID_HOME=$ANDROID_HOME"
echo "Syncing Android native project..."
(cd "$ROOT" && npx expo prebuild --platform android --no-install >/dev/null)

echo "Building signed release APK..."
GRADLE_BIN="$HOME/.gradle/wrapper/dists/gradle-8.13-bin/5xuhj0ry160q40clulazy9h7d/gradle-8.13/bin/gradle"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle}"
if [[ -x "$GRADLE_BIN" ]]; then
  (cd "$ROOT/android" && "$GRADLE_BIN" :app:assembleRelease)
else
  (cd "$ROOT/android" && ./gradlew :app:assembleRelease)
fi

APK_SRC="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK_SRC" ]]; then
  echo "Build failed: $APK_SRC not found"
  exit 1
fi

VERSION="$(node -p "require('$ROOT/app.json').expo.version")"
mkdir -p "$DIST"
APK_OUT="$DIST/vPay-${VERSION}-release.apk"
cp "$APK_SRC" "$APK_OUT"

BT="$(ls -d "$ANDROID_HOME/build-tools"/* | sort -V | tail -1)"
PACKAGE="$("$BT/aapt" dump badging "$APK_OUT" | sed -n "s/package: name='\\([^']*\\)'.*/\\1/p")"
ABIS="$("$BT/aapt" dump badging "$APK_OUT" | sed -n "s/native-code: '\\([^']*\\)'.*/\\1/p")"

echo
echo "Release APK ready:"
echo "  $APK_OUT"
echo "  $(du -h "$APK_OUT" | awk '{print $1}')"
echo
echo "Package: $PACKAGE"
echo "ABIs:    $ABIS"
echo
echo "Install on a physical device:"
echo "  1. Uninstall any older vPay/debug build first (Settings → Apps → vPay → Uninstall)"
echo "  2. Copy the APK to your phone, or run:"
echo "       adb install -r \"$APK_OUT\""
echo
echo "Note: use the .apk file above — .aab bundles cannot be installed directly."
