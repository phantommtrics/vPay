#!/usr/bin/env bash
# Build appAdmin and rsync dist/ to the server web root.
# Usage: bash backend/deployment/deploy-admin.sh [user@host]
# Default remote path: /var/www/vpay-admin

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE="${1:-}"
REMOTE_PATH="/var/www/vpay-admin"

echo "==> Building appAdmin"
cd "$ROOT/appAdmin"
npm ci
npm run build

if [[ -z "$REMOTE" ]]; then
  echo ""
  echo "Build complete: $ROOT/appAdmin/dist"
  echo "Upload manually:"
  echo "  rsync -av --delete dist/ user@server:$REMOTE_PATH/"
  exit 0
fi

echo "==> Uploading to $REMOTE:$REMOTE_PATH"
rsync -av --delete dist/ "$REMOTE:$REMOTE_PATH/"

echo "==> Done. Verify: curl -s -o /dev/null -w '%{http_code}\n' https://api.vpayafrica.phantommetrics.gm/"
