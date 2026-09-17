#!/usr/bin/env bash

set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0
TS='--include=*.ts --include=*.tsx'

report() {
  if [ -n "$3" ]; then
    printf '\n\033[31m✗ %s\033[0m — %s\n' "$1" "$2"
    printf '%s\n' "$3" | sed 's/^/    /'
    FAIL=1
  else
    printf '\033[32m✓ %s\033[0m — %s\n' "$1" "$2"
  fi
}

no_comments() { grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' || true; }

HITS=$(grep -rn $TS '\.from(' src 2>/dev/null \
  | grep -vE '(Array|Buffer|Object|Uint8Array|Int8Array|Float32Array|Set|Map)\.from' \
  | grep -vE '^src/lib/db/' | no_comments || true)
report "R-01" "supabase.from() only inside src/lib/db/" "$HITS"

HITS=$(grep -rn $TS -E '\.(insert|upsert|update|delete)\(' src 2>/dev/null \
  | grep -E 'supabase|\.from\(' \
  | grep -vE '^src/lib/db/' | no_comments || true)
report "R-02" "no direct table writes outside src/lib/db/" "$HITS"

HITS=$(grep -rn --include=*.css -E '#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\b' src 2>/dev/null \
  | grep -v '^src/styles/tokens/primitives.css' || true)
report "R-20" "no hex outside primitives.css" "$HITS"

HITS=$(grep -rn $TS -E "['\"\`]#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\b" src 2>/dev/null \
  | grep -vE '^src/components/ui/' \
  | grep -vE '^src/lib/messaging/email-theme\.ts' \
  | grep -vE '^src/lib/config/browser-theme\.ts' | no_comments || true)
report "R-20" "no hex literal in a component" "$HITS"

test -f tests/unit/messaging/email-theme.test.ts \
  || report "R-20" "the email palette drift test still exists" \
     "tests/unit/messaging/email-theme.test.ts is missing — the email hex exemption is now unguarded"

test -f tests/unit/config/browser-theme.test.ts \
  || report "R-20" "the browser-chrome drift test still exists" \
     "tests/unit/config/browser-theme.test.ts is missing — the theme-color hex exemption is now unguarded"

HITS=$(grep -rn $TS -E '\b(bg|text|border|fill|stroke|ring|shadow|from|via|to)-\[#' src 2>/dev/null \
  | grep -vE '^src/components/ui/' || true)
report "R-21" "no arbitrary colour values" "$HITS"

HITS=$(grep -rn $TS -E '\b(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|w|h|min-w|min-h|max-w|max-h|rounded|space-x|space-y|top|right|bottom|left|inset)-\[[0-9]' src 2>/dev/null \
  | grep -vE '^src/components/ui/' || true)
report "R-21" "no arbitrary spacing or radius values" "$HITS"

HITS=$(grep -rn $TS -E '(bufferMinutes|holdMinutes|startInterval|childMinAge|childMaxAge|bookerMinAge|serviceFee|urgencyThreshold)\s*[:=]\s*[0-9]' src 2>/dev/null \
  | grep -vE '^src/lib/config/' || true)
report "R-05" "no named business constant outside src/lib/config/" "$HITS"

HITS=$(grep -rn $TS -E 'SUPABASE_(SECRET_KEY|SERVICE_ROLE_KEY)' src 2>/dev/null \
  | grep -vE '^src/lib/db/admin\.ts' \
  | grep -vE '^src/app/api/webhooks/' \
  | grep -vE '^src/app/api/cron/' | no_comments || true)
report "SEC" "service-role key named only where an admin client is built" "$HITS"

HITS=$(grep -rn $TS -E 'createAdminClient|adminAuthRequest' src 2>/dev/null \
  | grep -vE '^src/lib/db/admin\.ts' \
  | grep -vE '^src/app/api/webhooks/' \
  | grep -vE '^src/app/api/cron/' \
  | grep -vE '^src/lib/services/staff-access-service\.ts' \
  | grep -vE '^src/lib/db/guest-checkout\.ts' \
  | grep -vE '^src/lib/db/payment-events\.ts' \
  | grep -vE '^src/lib/db/queries/rate-limit-settings\.ts' \
  | grep -vE '^src/lib/db/message-templates-send\.ts' | no_comments || true)
report "SEC2" "admin client constructed only in its documented, explicitly permitted call sites" "$HITS"

HITS=$(grep -rn $TS -E 'paymentCallbackClient' src 2>/dev/null \
  | grep -vE '^src/lib/db/payment-events\.ts' \
  | grep -vE '^src/lib/services/payment-callback\.ts' | no_comments || true)
report "SEC3" "the payment callback's service-role client used only by the callback" "$HITS"
MISSING=""
for VAR in $(grep -rhoE $TS 'process\.env\.[A-Z0-9_]+' src tests scripts 2>/dev/null | sed 's/process\.env\.//' | sort -u); do
  case "$VAR" in NODE_ENV|VERCEL_*|npm_*|TZ) continue ;; esac
  grep -q "^${VAR}=" .env.example 2>/dev/null || MISSING="${MISSING}${VAR} used in src, tests or scripts but absent from .env.example\n"
done
report "R-37" ".env.example lists every variable used" "$(printf "%b" "$MISSING" | grep . || true)"

HITS=$(grep -rn $TS "/brand/" src 2>/dev/null \
  | grep -vE '^src/components/shared/wordmark\.tsx' \
  | grep -vE '^src/lib/messaging/templates/layout\.ts' \
  | grep -vE '^src/lib/documents/tax-document-pdf\.tsx' | no_comments || true)
report "BRAND" "logo files referenced only by the Wordmark component" "$HITS"

MISSING=""
for T in $(grep -rhoE 'create table (if not exists )?public\.[a-z_]+' supabase/migrations 2>/dev/null \
           | grep -oE 'public\.[a-z_]+$' | sort -u); do
  grep -rqE "alter table (if exists )?${T}[[:space:]]+enable row level security" supabase/migrations 2>/dev/null \
    || MISSING="${MISSING}${T} has no ENABLE ROW LEVEL SECURITY\n"
done
report "R-13" "RLS enabled on every table in public" "$(printf "%b" "$MISSING" | grep . || true)"
ANON_EXEMPT='grant[[:space:]]+usage[[:space:]]+on[[:space:]]+schema'
ANON_EXEMPT="$ANON_EXEMPT|grant[[:space:]]+execute[[:space:]]+on[[:space:]]+function[[:space:]]+public\.submit_waitlist_entry\b"
ANON_EXEMPT="$ANON_EXEMPT|grant[[:space:]]+execute[[:space:]]+on[[:space:]]+function[[:space:]]+public\.count_available_suites\b"
ANON_EXEMPT="$ANON_EXEMPT|grant[[:space:]]+select[[:space:]]+on[[:space:]]+public\.public_booking_settings\b"
ANON_EXEMPT="$ANON_EXEMPT|grant[[:space:]]+select[[:space:]]+on[[:space:]]+public\.cms_published_content\b"
ANON_EXEMPT="$ANON_EXEMPT|grant[[:space:]]+select[[:space:]]+on[[:space:]]+public\.public_price_rules\b"
ANON_EXEMPT="$ANON_EXEMPT|grant[[:space:]]+select[[:space:]]+on[[:space:]]+public\.public_addons\b"
HITS=$(for f in supabase/migrations/*.sql; do
  [ -e "$f" ] || continue
  sed 's/--.*$//' "$f" | tr '\n' ' ' | tr ';' '\n' \
    | grep -iE '\bgrant\b.*\bto\b.*\banon\b' \
    | grep -viE "$ANON_EXEMPT" \
    | sed "s|^|${f}: |"
done)
report "INV-01" "no anon grant on any table, view or function" "$HITS"

MISSING=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  N_DEF=$(grep -ciE '^[[:space:]]*security definer' "$f" || true)
  N_PATH=$(grep -ciE "^[[:space:]]*set search_path = ''" "$f" || true)
  [ "$N_DEF" -gt "$N_PATH" ] && MISSING="${MISSING}${f}: ${N_DEF} security definer, only ${N_PATH} with pinned search_path\n"
done <<< "$(grep -rlE '^[[:space:]]*security definer' supabase/migrations 2>/dev/null || true)"
report "R-15" "every SECURITY DEFINER pins search_path" "$(printf "%b" "$MISSING" | grep . || true)"

HITS=$(grep -rnE '(^|[[:space:](,])(price|amount|fee|total|revenue|refund|[a-z_]+_fils)[a-z_]*[[:space:]]+(numeric|decimal|real|double precision|float)([[:space:](,;]|$)|::[[:space:]]*(real|double precision|float)([[:space:](,;]|$)' supabase/migrations 2>/dev/null || true)
report "R-16" "money stored as integer fils; no floating-point casts" "$HITS"

HITS=$(grep -rnE '[a-z_]+_at[[:space:]]+timestamp([^t]|$)' supabase/migrations 2>/dev/null || true)
report "R-16" "timestamps are timestamptz, never timestamp" "$HITS"

printf '\n'
if [ "$FAIL" -ne 0 ]; then
  printf '\033[31mBoundary checks failed.\033[0m See doc 3 Part 4.2 and SYSTEM.md Part 12.\n'
  exit 1
fi
printf '\033[32mBoundary checks passed.\033[0m\n'
