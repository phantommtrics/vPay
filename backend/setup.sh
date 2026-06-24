#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Installing dependencies..."
npm install --no-audit --no-fund --legacy-peer-deps

echo "→ Generating Prisma client..."
npx prisma generate

if ! PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw vpay; then
  echo "→ Creating database vpay..."
  PGPASSWORD="${PGPASSWORD:-postgres}" createdb -h localhost -U postgres vpay 2>/dev/null \
    || PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -U postgres -c "CREATE DATABASE vpay;"
fi

echo "→ Applying migrations..."
npx prisma migrate deploy

echo ""
echo "✓ Backend ready. Start with: npm run dev"
