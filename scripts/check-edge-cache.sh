#!/usr/bin/env bash
# F-22 (D-02) — verificación en producción de la caché de borde y de la CSP.
# Uso: bash scripts/check-edge-cache.sh [https://kulturaapp.vercel.app]
# ≤ 1 petición/s, sin sesión. Sale con código 1 si algún criterio falla.
set -u
BASE="${1:-https://kulturaapp.vercel.app}"
YEAR="$(date -u +%Y)"
RANK="/es/best/movie/$YEAR"
fail=0
ok() { echo "  OK    $*"; }
ko() { echo "  FALLO $*"; fail=1; }
h() { curl -sS -o /dev/null -D - "$BASE$1" | tr -d '\r'; }
hv() { grep -i "^$2:" <<<"$1" | head -1 | cut -d' ' -f2-; }

echo "== 1. $RANK: la 2.ª petición sale del CDN (HIT y age > 0)"
h "$RANK" >/dev/null; sleep 2
H2="$(h "$RANK")"
cache="$(hv "$H2" x-vercel-cache)"; age="$(hv "$H2" age)"
[[ "$cache" == "HIT" || "$cache" == "STALE" ]] && ok "x-vercel-cache: $cache" || ko "x-vercel-cache: ${cache:-—}"
[[ "${age:-0}" -gt 0 ]] && ok "age: $age" || ko "age: ${age:-—}"
[[ -z "$(hv "$H2" set-cookie)" ]] && ok "sin set-cookie" || ko "set-cookie: $(hv "$H2" set-cookie)"

echo "== 2. TTFB p50 ≤ 150 ms en 10 tomas (1/s)"
for p in "$RANK" /es /es/privacy; do
  t=()
  for i in $(seq 1 10); do
    t+=("$(curl -sS -o /dev/null -w '%{time_starttransfer}' "$BASE$p")"); sleep 1
  done
  p50="$(printf '%s\n' "${t[@]}" | sort -n | sed -n '5p;6p' | awk '{s+=$1} END {printf "%d", s/2*1000}')"
  [[ "$p50" -le 150 ]] && ok "$p p50 = ${p50} ms" || ko "$p p50 = ${p50} ms (tomas: ${t[*]})"
done

echo "== 3. CSP: fija en las cacheables, nonce en el resto, nunca unsafe-eval"
for p in /es /en "$RANK" /es/best /es/privacy /es/terms /es/legal /es/accessibility /es/offline; do
  csp="$(hv "$(h "$p")" content-security-policy)"; sleep 1
  if [[ "$csp" == *"script-src 'self' 'unsafe-inline'"* && "$csp" != *nonce-* && "$csp" != *unsafe-eval* ]]; then ok "$p fija"; else ko "$p: $csp"; fi
done
for p in /es/login /es/u/benevi; do
  csp="$(hv "$(h "$p")" content-security-policy)"; sleep 1
  if [[ "$csp" == *"'nonce-"* && "$csp" != *unsafe-eval* ]]; then ok "$p con nonce"; else ko "$p: $csp"; fi
done

echo "== 4. /es/u/benevi sigue privado y fuera de la caché"
H="$(h /es/u/benevi)"
[[ "$(hv "$H" cache-control)" == private* ]] && ok "cache-control: $(hv "$H" cache-control)" || ko "cache-control: $(hv "$H" cache-control)"
[[ "$(hv "$H" x-vercel-cache)" == "MISS" ]] && ok "x-vercel-cache: MISS" || ko "x-vercel-cache: $(hv "$H" x-vercel-cache)"

echo "== 5. Ranking inventado: 404 dinámica, sin caché"
H="$(h /es/best/movie/abc)"
[[ "$(head -1 <<<"$H")" == *404* ]] && ok "404" || ko "$(head -1 <<<"$H")"
[[ "$(hv "$H" cache-control)" == *no-store* ]] && ok "cache-control: $(hv "$H" cache-control)" || ko "cache-control: $(hv "$H" cache-control)"

echo "== 6. Router de Next desde una página cacheable hacia una con nonce → 409 (carga completa)"
code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'RSC: 1' -H 'Sec-Fetch-Dest: empty' -H "Referer: $BASE/es/privacy" "$BASE/es/login")"
[[ "$code" == "409" ]] && ok "409" || ko "HTTP $code"
code="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Sec-Fetch-Dest: document' -H "Referer: $BASE/es/privacy" "$BASE/es/login")"
[[ "$code" == "200" ]] && ok "carga de documento normal: 200" || ko "documento: HTTP $code"

echo "== 7. Service worker: /sw.js con SU CSP (la del worker) y /sw-config.json sin CSP"
SW_CSP="default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'"
H="$(h /sw.js)"; sleep 1
[[ "$(hv "$H" content-security-policy)" == "$SW_CSP" && -z "$(hv "$H" content-security-policy-report-only)" ]] \
  && ok "/sw.js con la CSP del worker ($(hv "$H" cache-control))" || ko "/sw.js: CSP «$(hv "$H" content-security-policy)»"
H="$(h /sw-config.json)"; sleep 1
[[ -z "$(hv "$H" content-security-policy)$(hv "$H" content-security-policy-report-only)" ]] && ok "/sw-config.json sin CSP ($(hv "$H" cache-control))" || ko "/sw-config.json lleva CSP"

echo "== 8. Informes de CSP: /api/csp-report responde 204"
code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/csp-report' \
  --data '{"csp-report":{"document-uri":"'"$BASE"'/es","blocked-uri":"inline","effective-directive":"script-src-elem","disposition":"report"}}' \
  "$BASE/api/csp-report")"
[[ "$code" == "204" ]] && ok "204" || ko "HTTP $code"

echo
[[ $fail -eq 0 ]] && echo "TODO CORRECTO" || echo "HAY FALLOS"
exit $fail
