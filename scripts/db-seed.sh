#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${WELLPLACE_TEST_DB_NAME:-wellplace-test-db}"
[ -f supabase/seed/reference-data.sql ] || { echo "→ no seed file yet"; exit 0; }
docker exec -i "$NAME" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -q < supabase/seed/reference-data.sql
echo "✓ reference data seeded"
