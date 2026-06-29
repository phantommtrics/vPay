#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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
  echo "JAVA_HOME is not set to a valid Java installation."
  echo "Install JDK 17, then either:"
  echo "  brew install openjdk@17"
  echo "  export JAVA_HOME=\"\$(/usr/libexec/java_home -v 17)\""
  exit 1
fi

if ! ANDROID_SDK="$(resolve_android_sdk)"; then
  echo "Android SDK not found."
  echo "Install Android Studio, then open SDK Manager and install:"
  echo "  - Android SDK Platform"
  echo "  - Android SDK Build-Tools"
  echo "Or set ANDROID_HOME to your SDK path."
  exit 1
fi

export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_SDK_ROOT="$ANDROID_SDK"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

LOCAL_PROPS="$ROOT/android/local.properties"
printf 'sdk.dir=%s\n' "$ANDROID_SDK" > "$LOCAL_PROPS"

echo "Using JAVA_HOME=$JAVA_HOME"
echo "Using ANDROID_HOME=$ANDROID_HOME"

KEYSTORE_PROPS="$ROOT/android-signing/keystore.properties"
KEYSTORE_FILE="$ROOT/android-signing/vpay-upload.keystore"

if [[ ! -f "$KEYSTORE_FILE" ]]; then
  echo "Upload keystore not found. Run: npm run mobile:setup:play-upload-key"
  exit 1
fi

if [[ ! -f "$KEYSTORE_PROPS" ]]; then
  echo "Missing $KEYSTORE_PROPS"
  echo "Copy android-signing/keystore.properties.example and set your real passwords."
  exit 1
fi

if grep -q 'YOUR_STORE_PASSWORD\|YOUR_KEY_PASSWORD' "$KEYSTORE_PROPS"; then
  echo "Release signing is not configured yet."
  echo "Edit mobile/android-signing/keystore.properties and replace the placeholder passwords"
  echo "with the password you chose when creating vpay-upload.keystore."
  exit 1
fi

cd "$ROOT/android"
./gradlew clean :app:assembleRelease :app:bundleRelease
