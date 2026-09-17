#!/usr/bin/env bash
set -euo pipefail
NAME="${WELLPLACE_TEST_DB_NAME:-wellplace-test-db}"
docker rm -f "$NAME" >/dev/null 2>&1 && echo "✓ removed ${NAME}" || echo "→ ${NAME} was not running"
