#!/usr/bin/env bash
set -euo pipefail

NAME="${WELLPLACE_TEST_REST_NAME:-wellplace-test-rest}"
PORT="${WELLPLACE_TEST_REST_PORT:-3001}"
PGRST_PORT="${WELLPLACE_TEST_PGRST_PORT:-3002}"
DB_PORT="${WELLPLACE_TEST_DB_PORT:-54329}"
IMAGE="${WELLPLACE_TEST_REST_IMAGE:-public.ecr.aws/supabase/postgrest:v16.1}"

if [ -z "$(docker ps -q -f "name=^${WELLPLACE_TEST_DB_NAME:-wellplace-test-db}$")" ]; then
  echo "✗ the database is not running. Run: npm run db:test:up"
  exit 1
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true
echo "→ starting ${NAME} on :${PORT}"
docker run -d --name "$NAME" --network host \
  -e PGRST_DB_URI="postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres" \
  -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_SERVER_PORT="$PGRST_PORT" \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if curl -fs -o /dev/null "http://127.0.0.1:${PGRST_PORT}/"; then
    pkill -f "scripts/rest-proxy.mjs" 2>/dev/null || true
    PROXY_PORT="$PORT" PGRST_PORT="$PGRST_PORT" \
      nohup node scripts/rest-proxy.mjs >/tmp/wellplace-rest-proxy.log 2>&1 &
    sleep 1
    echo "✓ ready — http://127.0.0.1:${PORT} (set NEXT_PUBLIC_SUPABASE_URL to this)"
    exit 0
  fi
  sleep 1
done
echo "✗ PostgREST did not become ready"
docker logs --tail 20 "$NAME"
exit 1
