#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

source_android_env() {
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
    set +a
  fi
}

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
  echo "JAVA_HOME is not set. Install JDK 17 first."
  exit 1
fi

if ! ANDROID_SDK="$(resolve_android_sdk)"; then
  echo "Android SDK not found."
  exit 1
fi

export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_SDK_ROOT="$ANDROID_SDK"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export NODE_ENV=production
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle}"

source_android_env

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  echo "EXPO_PUBLIC_API_URL is required for Play Store builds."
  echo "Add it to mobile/.env, for example:"
  echo "  EXPO_PUBLIC_API_URL=https://api.yourdomain.com"
  exit 1
fi

if [[ "${EXPO_PUBLIC_API_URL}" == http://localhost* ]] \
  || [[ "${EXPO_PUBLIC_API_URL}" == http://127.0.0.1* ]] \
  || [[ "${EXPO_PUBLIC_API_URL}" == http://10.0.2.2* ]]; then
  echo "EXPO_PUBLIC_API_URL must be a public production URL, not a local/dev host."
  exit 1
fi

KEYSTORE_PROPS="$ROOT/android-signing/keystore.properties"
KEYSTORE_FILE="$ROOT/android-signing/vpay-upload.keystore"
if [[ ! -f "$KEYSTORE_FILE" || ! -f "$KEYSTORE_PROPS" ]]; then
  echo "Release signing not configured. Run: npm run setup:play-upload-key"
  exit 1
fi

printf 'sdk.dir=%s\n' "$ANDROID_SDK" > "$ROOT/android/local.properties"

echo "Using JAVA_HOME=$JAVA_HOME"
echo "Using ANDROID_HOME=$ANDROID_HOME"
echo "Using EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL"

echo "Syncing Android native project..."
(cd "$ROOT" && npx expo prebuild --platform android --no-install >/dev/null)

echo "Building signed Play Store bundle..."
GRADLE_BIN="$HOME/.gradle/wrapper/dists/gradle-8.13-bin/5xuhj0ry160q40clulazy9h7d/gradle-8.13/bin/gradle"
if [[ -x "$GRADLE_BIN" ]]; then
  (cd "$ROOT/android" && "$GRADLE_BIN" :app:assembleRelease :app:bundleRelease)
else
  (cd "$ROOT/android" && ./gradlew :app:assembleRelease :app:bundleRelease)
fi

BUNDLE_PATH="$ROOT/android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle"
APK_SRC="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
AAB_SRC="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"

if [[ ! -f "$BUNDLE_PATH" || ! -f "$APK_SRC" || ! -f "$AAB_SRC" ]]; then
  echo "Build outputs missing."
  exit 1
fi

node "$ROOT/scripts/validate-android-bundle.mjs" "$BUNDLE_PATH"

VERSION="$(node -p "require('$ROOT/app.json').expo.version")"
VERSION_CODE="$(node -p "require('$ROOT/app.json').expo.android.versionCode")"
mkdir -p "$DIST"

APK_OUT="$DIST/vPay-${VERSION}-release.apk"
AAB_OUT="$DIST/vPay-${VERSION}-release.aab"
cp "$APK_SRC" "$APK_OUT"
cp "$AAB_SRC" "$AAB_OUT"

BT="$(ls -d "$ANDROID_HOME/build-tools"/* | sort -V | tail -1)"
PACKAGE="$("$BT/aapt" dump badging "$APK_OUT" | sed -n "s/package: name='\\([^']*\\)'.*/\\1/p")"
ABIS="$("$BT/aapt" dump badging "$APK_OUT" | sed -n "s/native-code: '\\([^']*\\)'.*/\\1/p")"
"$BT/apksigner" verify "$APK_OUT" >/dev/null

echo
echo "Play Store build ready:"
echo "  AAB (upload to Play Console): $AAB_OUT"
echo "  APK (local install/testing):  $APK_OUT"
echo
echo "Package:      $PACKAGE"
echo "Version:      $VERSION ($VERSION_CODE)"
echo "API URL:      $EXPO_PUBLIC_API_URL"
echo "ABIs:         $ABIS"
echo
echo "Upload $AAB_OUT to Play Console internal testing, then install from Play Store to verify launch."
