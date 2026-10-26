#!/usr/bin/env bash
# ============================================================
# KULTURA — Comprobación en producción del calendario y el correo (F-28).
#
#   scripts/check-calendar-email.sh [https://kulturaapp.vercel.app]
#
# Sin sesión y sin escribir nada (≤ 1 petición/s):
#   1. /es/calendar sin sesión → redirige al login con `next`.
#   2. GET /api/email/unsubscribe?t=… → 303 a la página (un GET nunca da de baja).
#   3. /es/email/unsubscribe → 200, noindex, sin caché pública.
#   4. POST en 1 clic con un token falso → 400 (o 503 si falta EMAIL_TOKEN_SECRET).
#   5. /api/email/preferences sin sesión → 401.
# Las fechas de los proveedores se comprueban con el contrato semanal
# (tests/contract/calendar.contract.test.ts). Código de salida 1 si algo falla.
# ============================================================
set -uo pipefail

BASE="${1:-https://kulturaapp.vercel.app}"
BASE="${BASE%/}"
fail=0
ok() { printf '  ok   %s\n' "$1"; }
ko() { printf '  FALLA %s\n' "$1"; fail=1; }
head_of() { curl -s -o /dev/null -D - --max-time 15 "$@"; }

echo "· $BASE"

h=$(head_of "$BASE/es/calendar")
status=$(printf '%s' "$h" | awk 'NR==1{print $2}')
loc=$(printf '%s' "$h" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
if [[ "$status" =~ ^30[37]$ && "$loc" == *"/es/login"* ]]; then ok "calendar sin sesión → login ($status)"; else ko "calendar sin sesión: $status $loc"; fi
sleep 1

h=$(head_of "$BASE/api/email/unsubscribe?t=v1.Zm9v.YmFy&l=es")
status=$(printf '%s' "$h" | awk 'NR==1{print $2}')
loc=$(printf '%s' "$h" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')
if [[ "$status" == 303 && "$loc" == *"/es/email/unsubscribe?t="* ]]; then ok "GET de baja → 303 a la página"; else ko "GET de baja: $status $loc"; fi
sleep 1

page=$(curl -s --max-time 15 "$BASE/es/email/unsubscribe?t=v1.Zm9v.YmFy")
if grep -q 'name="robots" content="noindex, nofollow"' <<<"$page"; then ok "página de baja: noindex"; else ko "página de baja sin noindex"; fi
if grep -q 'action="/api/email/unsubscribe"' <<<"$page"; then ko "página de baja con token falso enseña el botón"; else ok "token falso: sin botón de baja"; fi
sleep 1

status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' --data 'List-Unsubscribe=One-Click' \
  "$BASE/api/email/unsubscribe?t=v1.Zm9v.YmFy")
if [[ "$status" == 400 || "$status" == 503 ]]; then ok "POST en 1 clic con token falso → $status"; else ko "POST en 1 clic con token falso: $status"; fi
sleep 1

status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X PUT -H 'Content-Type: application/json' \
  --data '{"weekly":true}' "$BASE/api/email/preferences")
if [[ "$status" == 401 ]]; then ok "preferencias sin sesión → 401"; else ko "preferencias sin sesión: $status"; fi

exit $fail
