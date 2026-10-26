#!/usr/bin/env bash
# F-26 — Verificación de los importadores contra producción y contra la forma
# REAL de las respuestas de los proveedores (los tests usan fixtures copiadas
# de la documentación porque el proxy de desarrollo bloquea TMDB, AniList,
# Jikan y Open Library).
#
# Uso:
#   bash scripts/import-verify.sh [https://kulturaapp.vercel.app]
#   TMDB_API_KEY=… bash scripts/import-verify.sh            # + forma de TMDB /find y /search
#   KULTURA_COOKIE='sb-…=…' bash scripts/import-verify.sh   # + un lote real de 3 filas
#
# KULTURA_COOKIE: la cabecera Cookie de TU sesión (DevTools → Red → cualquier
# petición a /api → Cookie). Importa 3 películas conocidas en tu biblioteca
# (idempotente: repetirlo no duplica). No crea cuentas ni toca otras.
# ≤ 1 petición/s. Sale con código 1 si algún criterio falla. Necesita curl y jq.
set -u
BASE="${1:-https://kulturaapp.vercel.app}"
fail=0
ok() { echo "  OK    $*"; }
ko() { echo "  FALLO $*"; fail=1; }
skip() { echo "  --    $*"; }
command -v jq >/dev/null || { echo "Falta jq"; exit 2; }

echo "== 1. Rutas nuevas sin sesión"
code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/es/settings/import")"
[[ "$code" == "307" || "$code" == "302" ]] && ok "/es/settings/import → $code (pide sesión)" || ko "/es/settings/import → $code"
sleep 1
csp="$(curl -sS -o /dev/null -D - "$BASE/es/settings/import" | tr -d '\r' | grep -i '^content-security-policy:' | head -1)"
[[ "$csp" == *"nonce-"* ]] && ok "CSP con nonce (zona con sesión, no estática)" || ko "CSP sin nonce: ${csp:-—}"
sleep 1
code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Origin: $BASE" --data '{"source":"letterboxd","items":[]}' "$BASE/api/account/import/external")"
[[ "$code" == "401" || "$code" == "403" ]] && ok "POST /api/account/import/external sin sesión → $code" || ko "POST sin sesión → $code"
sleep 1
code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/account/export/letterboxd?list=watched")"
[[ "$code" == "401" ]] && ok "GET /api/account/export/letterboxd sin sesión → 401" || ko "export sin sesión → $code"
sleep 1

echo "== 2. Forma real de los proveedores (lo que dan por hecho las fixtures)"
if [[ -n "${TMDB_API_KEY:-}" ]]; then
  j="$(curl -sS "https://api.themoviedb.org/3/find/tt0137523?external_source=imdb_id&language=es-ES&api_key=$TMDB_API_KEY")"
  [[ "$(jq -r '.movie_results[0].id' <<<"$j")" == "550" && "$(jq -r '.movie_results[0].release_date' <<<"$j")" == 1999-* ]] \
    && ok "TMDB /find imdb_id → movie_results[0] {id: 550, release_date}" || ko "TMDB /find imdb_id: $(head -c 200 <<<"$j")"
  sleep 1
  j="$(curl -sS "https://api.themoviedb.org/3/find/81189?external_source=tvdb_id&language=es-ES&api_key=$TMDB_API_KEY")"
  [[ "$(jq -r '.tv_results[0].id' <<<"$j")" == "1396" && "$(jq -r '.tv_results[0].first_air_date' <<<"$j")" == 2008-* ]] \
    && ok "TMDB /find tvdb_id → tv_results[0] {id: 1396, first_air_date}" || ko "TMDB /find tvdb_id: $(head -c 200 <<<"$j")"
  sleep 1
  j="$(curl -sS "https://api.themoviedb.org/3/search/movie?query=Halloween&language=en-US&api_key=$TMDB_API_KEY")"
  [[ "$(jq '[.results[] | select(.id == 948 and (.release_date | startswith("1978")) and .title == "Halloween")] | length' <<<"$j")" -ge 1 ]] \
    && ok "TMDB /search/movie en inglés: Halloween (1978) entre los 20 primeros" || ko "TMDB /search/movie Halloween 1978 no aparece"
  sleep 1
else
  skip "TMDB (define TMDB_API_KEY para comprobar /find y /search)"
fi

q='query ($ids: [Int], $perPage: Int) { Page(page: 1, perPage: $perPage) { media(idMal_in: $ids, type: ANIME) { id idMal isAdult title { romaji english } startDate { year } } } }'
j="$(curl -sS -X POST -H 'Content-Type: application/json' https://graphql.anilist.co \
  --data "$(jq -cn --arg q "$q" '{query: $q, variables: {ids: [1, 5114], perPage: 50}}')")"
[[ "$(jq '[.data.Page.media[] | select(.idMal == 1 and .id == 1)] | length' <<<"$j")" == "1" && "$(jq '.data.Page.media | length' <<<"$j")" == "2" ]] \
  && ok "AniList idMal_in → 2 fichas con idMal (Cowboy Bebop = al-1)" || ko "AniList idMal_in: $(head -c 300 <<<"$j")"
sleep 1
j="$(curl -sS https://api.jikan.moe/v4/anime/5114/full)"
[[ "$(jq -r '.data.mal_id' <<<"$j")" == "5114" && "$(jq -r '.data.rating' <<<"$j")" != "null" ]] \
  && ok "Jikan /anime/5114/full → data {mal_id, rating}" || ko "Jikan: $(head -c 200 <<<"$j")"
sleep 1
j="$(curl -sS 'https://openlibrary.org/search.json?q=isbn:9780439023481&limit=1&fields=key,title,author_name,first_publish_year,cover_i')"
[[ "$(jq -r '.docs[0].key' <<<"$j")" =~ ^/works/OL[0-9]+W$ ]] \
  && ok "Open Library isbn → docs[0].key = $(jq -r '.docs[0].key' <<<"$j") ($(jq -r '.docs[0].title' <<<"$j"))" || ko "Open Library: $(head -c 200 <<<"$j")"
sleep 1

echo "== 3. Un lote real con tu sesión (opcional)"
if [[ -n "${KULTURA_COOKIE:-}" ]]; then
  body='{"source":"letterboxd","items":[
    {"key":"0","kind":"movie","title":"Fight Club","year":1999,"status":"completed","rating10":9,"watchedAt":null},
    {"key":"1","kind":"movie","title":"Halloween","year":1978,"status":"pending","rating10":null,"watchedAt":null},
    {"key":"2","kind":"movie","title":"Película que no existe zzz","year":1901,"status":"completed","rating10":null,"watchedAt":null}]}'
  j="$(curl -sS -X POST -H 'Content-Type: application/json' -H "Origin: $BASE" -H "Referer: $BASE/es/settings/import" \
    -H "Cookie: $KULTURA_COOKIE" --data "$body" "$BASE/api/account/import/external")"
  [[ "$(jq -r '.results[0].mediaId' <<<"$j")" == "movie_550" ]] && ok "Fight Club → movie_550 ($(jq -r '.results[0].outcome' <<<"$j"))" || ko "lote: $(head -c 300 <<<"$j")"
  [[ "$(jq -r '.results[1].mediaId' <<<"$j")" == "movie_948" ]] && ok "Halloween (1978) → movie_948, no el remake" || ko "Halloween: $(jq -c '.results[1]' <<<"$j")"
  [[ "$(jq -r '.results[2].outcome' <<<"$j")" == "unmatched" ]] && ok "título inexistente → unmatched" || ko "inexistente: $(jq -c '.results[2]' <<<"$j")"
  sleep 1
  csv="$(curl -sS -H "Cookie: $KULTURA_COOKIE" "$BASE/api/account/export/letterboxd?list=watched" | head -1 | tr -d '\r')"
  [[ "$csv" == "tmdbID,Title,Year,Rating,WatchedDate,Rewatch,Review" ]] && ok "export Letterboxd: cabecera del formato de importación" || ko "export: $csv"
else
  skip "lote real (define KULTURA_COOKIE con tu sesión)"
fi

echo
[[ $fail -eq 0 ]] && echo "TODO OK" || echo "HAY FALLOS"
exit $fail
