#!/usr/bin/env bash
set -euo pipefail

NAME="${WELLPLACE_TEST_DB_NAME:-wellplace-test-db}"
PORT="${WELLPLACE_TEST_DB_PORT:-54329}"
IMAGE="${WELLPLACE_TEST_DB_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.158}"

if [ -n "$(docker ps -q -f "name=^${NAME}$")" ]; then
  echo "→ ${NAME} already running on :${PORT}"
  exit 0
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true

echo "→ starting ${NAME} (${IMAGE}) on :${PORT}"
docker run -d --name "$NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -p "${PORT}:5432" \
  --tmpfs /var/lib/postgresql/data:rw \
  "$IMAGE" \
  -c listen_addresses='*' \
  -c shared_preload_libraries=pg_cron \
  -c cron.database_name=postgres \
  -c fsync=off -c full_page_writes=off -c synchronous_commit=off \
  >/dev/null

printf '→ waiting for readiness'
for _ in $(seq 1 90); do
  if docker exec "$NAME" psql -h 127.0.0.1 -U postgres -tAq -c "select 1" 2>/dev/null | grep -q 1; then
    docker exec "$NAME" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
      -c "create extension if not exists pg_cron; grant usage on schema cron to postgres; grant all on all tables in schema cron to postgres;" >/dev/null
    printf '\n'
    echo "✓ ready — postgresql://postgres:postgres@localhost:${PORT}/postgres"
    exit 0
  fi
  printf '.'
  sleep 1
done

printf '\n✗ database did not become ready\n'
docker logs --tail 40 "$NAME"
exit 1
