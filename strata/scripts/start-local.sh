#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/Users/kelly/Bear-Hacks-2026/strata"
UPLOADS_DIR="/tmp/strata-uploads"

cd "$REPO_DIR"

echo "[1/6] nuking build caches"
rm -rf .next node_modules/.cache .turbo

echo "[2/6] nuking uploads at ${UPLOADS_DIR}"
rm -rf "${UPLOADS_DIR:?}"/*

echo "[3/6] nuking database"
rm -f prisma/dev.db prisma/dev.db-journal

echo "[4/6] pushing fresh schema"
pnpm prisma db push --skip-generate

echo "[5/6] seeding demo accounts"
pnpm tsx scripts/seed-demo.ts

echo "[6/6] booting dev server"
pnpm dev
