#!/usr/bin/env bash
set -euo pipefail
NAME="${WELLPLACE_TEST_REST_NAME:-wellplace-test-rest}"
pkill -f "scripts/rest-proxy.mjs" 2>/dev/null || true
docker rm -f "$NAME" >/dev/null 2>&1 && echo "✓ removed ${NAME}" || echo "→ ${NAME} was not running"
