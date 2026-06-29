#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIGNING_DIR="$ROOT/android-signing"
KEYSTORE="$SIGNING_DIR/vpay-upload.keystore"
PROPS="$SIGNING_DIR/keystore.properties"
CERT="$SIGNING_DIR/upload_certificate.pem"
ALIAS="vpay-upload"

read_props() {
  if [[ ! -f "$PROPS" ]]; then
    return 1
  fi

  storePassword="$(grep '^storePassword=' "$PROPS" | cut -d= -f2- | tr -d '\r')"
  keyPassword="$(grep '^keyPassword=' "$PROPS" | cut -d= -f2- | tr -d '\r')"

  if [[ -z "$storePassword" || "$storePassword" == "YOUR_STORE_PASSWORD" ]]; then
    return 1
  fi
}

write_props() {
  cat > "$PROPS" <<EOF
storePassword=$1
keyPassword=$2
keyAlias=$ALIAS
storeFile=../../android-signing/vpay-upload.keystore
EOF
}

export_certificate() {
  local store_pass="$1"

  echo "Exporting upload certificate for Google Play..."
  keytool -export -rfc \
    -keystore "$KEYSTORE" \
    -alias "$ALIAS" \
    -file "$CERT" \
    -storepass "$store_pass"

  echo
  echo "Upload certificate created:"
  echo "  $CERT"
  echo
  echo "Next steps in Google Play Console:"
  echo "1. Create the app with package name: gm.phantommetrics.vpay"
  echo "2. Open Release > App integrity (or Setup > App signing)"
  echo "3. Under Upload key certificate, choose Register/upload key"
  echo "4. Upload this file: $CERT"
  echo "5. After Play accepts the upload key, run: npm run android:release"
  echo
  echo "Play App Signing keeps Google's app signing key. Your upload key only signs builds you upload."
}

mkdir -p "$SIGNING_DIR"

if [[ "${1:-}" == "export-only" ]]; then
  if [[ ! -f "$KEYSTORE" ]]; then
    echo "No upload keystore found. Run without export-only first."
    exit 1
  fi
  if ! read_props; then
    echo "Edit $PROPS with your real passwords, then run:"
    echo "  npm run export:play-upload-cert"
    exit 1
  fi
  export_certificate "$storePassword"
  exit 0
fi

if [[ -f "$KEYSTORE" ]]; then
  echo "Upload keystore already exists: $KEYSTORE"
  if read_props; then
    export_certificate "$storePassword"
    exit 0
  fi
  echo "Keystore exists but $PROPS still has placeholder passwords."
  echo "Edit that file, then run:"
  echo "  npm run export:play-upload-cert"
  exit 1
fi

echo "Creating Play upload keystore..."
echo "Choose one password for the upload keystore. You will need it for every release build."
read -r -s -p "Keystore password: " STORE_PASS
echo
read -r -s -p "Confirm password: " STORE_PASS_CONFIRM
echo

if [[ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]]; then
  echo "Passwords do not match. Aborting."
  exit 1
fi

keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$STORE_PASS" \
  -dname "CN=Phantommetrics vPay, OU=Mobile, O=Phantommetrics, L=Banjul, ST=Banjul, C=GM"

write_props "$STORE_PASS" "$STORE_PASS"
echo "Saved signing config to $PROPS"
export_certificate "$STORE_PASS"
