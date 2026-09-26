#!/usr/bin/env bash
# Build the consumer web app and rsync it to its own site.
# Usage: bash backend/deployment/deploy-customer-web.sh [user@host]
#
# Site:  https://customer.vpayafrica.phantommetrics.gm
# API:   https://api.vpayafrica.phantommetrics.gm  (override with EXPO_PUBLIC_API_URL)
# Remote path: /var/www/vpay-customer
#
# One-time nginx + DNS: backend/deployment/nginx/DEPLOY-CUSTOMER-WEB.md

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE="${1:-}"
REMOTE_PATH="/var/www/vpay-customer"
API_URL="${EXPO_PUBLIC_API_URL:-https://api.vpayafrica.phantommetrics.gm}"
SITE_URL="https://customer.vpayafrica.phantommetrics.gm"

echo "==> Building consumer web"
echo "    API ${API_URL}"
cd "$ROOT/mobile"
npm ci

# Shell env wins over mobile/.env so a local API URL is not baked into this build.
export EXPO_PUBLIC_API_URL="$API_URL"
export NODE_ENV=production
npx expo export --platform web --output-dir dist

if [[ -z "$REMOTE" ]]; then
  echo ""
  echo "Build complete: $ROOT/mobile/dist"
  echo "Upload manually:"
  echo "  rsync -av --delete dist/ user@server:$REMOTE_PATH/"
  echo ""
  echo "Then add ${SITE_URL} to backend CORS_ORIGINS and restart the API."
  echo "Nginx setup: backend/deployment/nginx/DEPLOY-CUSTOMER-WEB.md"
  exit 0
fi

echo "==> Uploading to $REMOTE:$REMOTE_PATH"
rsync -av --delete dist/ "$REMOTE:$REMOTE_PATH/"

echo "==> Done. Verify: curl -s -o /dev/null -w '%{http_code}\\n' ${SITE_URL}/"
echo "    API calls go to ${API_URL}. That origin must allow ${SITE_URL} in CORS_ORIGINS."
