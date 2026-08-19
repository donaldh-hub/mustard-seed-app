#!/usr/bin/env bash
set -euo pipefail

echo "[post-merge] Installing locked dependencies..."
npm ci --no-audit --no-fund

echo "[post-merge] Verifying production build..."
npm run build

echo "[post-merge] Done."
