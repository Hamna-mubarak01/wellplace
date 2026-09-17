#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${WELLPLACE_TEST_DB_NAME:-wellplace-test-db}"
if [ -z "$(docker ps -q -f "name=^${NAME}$")" ]; then
  echo "✗ ${NAME} is not running. Run: npm run db:test:up"
  exit 1
fi
docker exec -i "$NAME" psql -h 127.0.0.1 -U postgres -q \
  -c "drop extension if exists pgtap cascade;" \
  -c "create schema if not exists tap;" \
  -c "create extension if not exists pgtap with schema tap;" \
  -c "grant usage on schema tap to public;" >/dev/null

shopt -s nullglob
FILES=(supabase/tests/*.sql)
[ ${#FILES[@]} -eq 0 ] && { echo "→ no pgTAP tests yet"; exit 0; }

FAIL=0
for f in "${FILES[@]}"; do
  echo "── $(basename "$f")"
  if OUT=$( { printf 'set search_path = tap, public, pg_catalog;\n'; cat "$f"; } \
      | docker exec -i "$NAME" psql -h 127.0.0.1 -U postgres -X -q -v ON_ERROR_STOP=1 --no-align --tuples-only 2>&1); then
    printf '%s\n' "$OUT" | sed 's/^/   /'
    if printf '%s' "$OUT" | grep -qE '^not ok|# Looks like'; then FAIL=1; fi
  else
    printf '%s\n' "$OUT" | sed 's/^/   /'
    FAIL=1
  fi
done

echo
if [ "$FAIL" -ne 0 ]; then
  printf '\033[31m✗ pgTAP suite failed\033[0m\n'
  exit 1
fi
printf '\033[32m✓ pgTAP suite passed\033[0m\n'
