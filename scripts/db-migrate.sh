#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${WELLPLACE_TEST_DB_NAME:-wellplace-test-db}"
PSQL=(docker exec -i "$NAME" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -q)

if [ -z "$(docker ps -q -f "name=^${NAME}$")" ]; then
  echo "✗ ${NAME} is not running. Run: npm run db:test:up"
  exit 1
fi

"${PSQL[@]}" <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version     text primary key,
  name        text,
  inserted_at timestamptz not null default now()
);
SQL

shopt -s nullglob
FILES=(supabase/migrations/*.sql)
if [ ${#FILES[@]} -eq 0 ]; then echo "→ no migrations yet"; exit 0; fi

APPLIED=0 SKIPPED=0
for f in "${FILES[@]}"; do
  BASE=$(basename "$f")
  VERSION="${BASE%%_*}"
  IS_DONE=$(docker exec -i "$NAME" psql -h 127.0.0.1 -U postgres -tAq \
    -c "select 1 from supabase_migrations.schema_migrations where version = '${VERSION}'")
  if [ "$IS_DONE" = "1" ]; then
    SKIPPED=$((SKIPPED+1))
    continue
  fi
  printf '→ %s ' "$BASE"
  if OUT=$( { printf 'begin;\n'; cat "$f"; printf "\ninsert into supabase_migrations.schema_migrations(version,name) values ('%s','%s');\ncommit;\n" "$VERSION" "$BASE"; } | "${PSQL[@]}" 2>&1 ); then
    printf '\033[32mok\033[0m\n'
    APPLIED=$((APPLIED+1))
  else
    printf '\033[31mFAILED\033[0m\n%s\n' "$OUT"
    exit 1
  fi
done

echo "✓ ${APPLIED} applied, ${SKIPPED} already present"
