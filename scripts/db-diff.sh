#!/usr/bin/env bash
# ============================================================
# KULTURA — deriva entre supabase/migrations y una base de datos real.
#
#   scripts/db-diff.sh [--db-url URL] [--schema public] [--pg-major 17]
#       Deriva COMPLETA (tablas, columnas, índices, funciones, políticas RLS,
#       triggers…): `supabase db diff --db-url`. Levanta una base "sombra" con
#       todas las migraciones del repo y la compara con URL. Necesita Docker.
#
#   scripts/db-diff.sh --types [--db-url URL]
#       Deriva de TIPOS sin Docker: genera los tipos de URL con postgres-meta
#       (el mismo motor que usa `supabase gen types`) y los compara con el
#       bloque generado de src/types/supabase.ts (tablas, vistas, columnas,
#       tipos, nulos, claves ajenas y firmas de funciones; NO políticas).
#
#   scripts/db-diff.sh --gen-types [--db-url URL] [--generator pgmeta|cli]
#       Regenera el bloque `<supabase-gen-types>` de src/types/supabase.ts desde
#       URL. Solo sustituye lo que hay entre las marcas: los tipos de dominio
#       `Db*` (a mano) del mismo archivo se conservan. `--generator cli` usa
#       `supabase gen types typescript --db-url` (necesita Docker); por defecto
#       `pgmeta` (sin Docker).
#
# URL: --db-url o la variable SUPABASE_DB_URL. Para producción, Supabase →
# Connect → "Session pooler" (puerto 5432), con la contraseña de la base:
#   postgresql://postgres.<ref>:<contraseña>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
# La URL nunca se imprime.
#
# Códigos de salida: 0 = sin deriva (o tipos regenerados), 1 = deriva
# detectada, 2 = error de uso o de entorno (falta Docker, Node, la URL…).
# ============================================================
set -euo pipefail

# Versiones fijadas: cambiar a mano y a la vez (mismo resultado en todas partes).
SUPABASE_CLI_VERSION="2.120.0"
PGMETA_VERSION="0.100.0"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TYPES_FILE="$ROOT/src/types/supabase.ts"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
BEGIN_MARK="// <supabase-gen-types>"
END_MARK="// </supabase-gen-types>"

MODE="diff"
DB_URL="${SUPABASE_DB_URL:-}"
SCHEMA="public"
PG_MAJOR="17"
GENERATOR="pgmeta"

usage() {
  sed -n '3,/^# =====/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'
}
die() { echo "ERROR: $*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --db-url) [ $# -ge 2 ] || die "--db-url necesita un valor"; DB_URL="$2"; shift 2 ;;
    --db-url=*) DB_URL="${1#*=}"; shift ;;
    --schema) [ $# -ge 2 ] || die "--schema necesita un valor"; SCHEMA="$2"; shift 2 ;;
    --pg-major) [ $# -ge 2 ] || die "--pg-major necesita un valor"; PG_MAJOR="$2"; shift 2 ;;
    --generator) [ $# -ge 2 ] || die "--generator necesita un valor"; GENERATOR="$2"; shift 2 ;;
    --types) MODE="types"; shift ;;
    --gen-types) MODE="gen"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "opción desconocida: $1" ;;
  esac
done

[ -n "$DB_URL" ] || die "falta la URL de la base: exporta SUPABASE_DB_URL o pasa --db-url (Supabase → Connect → Session pooler)"
case "$DB_URL" in
  postgres://*|postgresql://*) ;;
  *) die "la URL debe empezar por postgresql:// (Supabase → Connect → Session pooler)" ;;
esac
case "$DB_URL" in
  *:6543/*) die "esa es la URL del 'Transaction pooler' (6543): usa la del 'Session pooler' (5432)" ;;
esac
case "$GENERATOR" in pgmeta|cli) ;; *) die "--generator debe ser pgmeta o cli" ;; esac
[[ "$SCHEMA" =~ ^[a-z_][a-z0-9_,]*$ ]] || die "--schema no válido: $SCHEMA"
[[ "$PG_MAJOR" =~ ^[0-9]{2}$ ]] || die "--pg-major no válido: $PG_MAJOR"
[ -f "$TYPES_FILE" ] || die "no encuentro $TYPES_FILE"
[ -d "$MIGRATIONS_DIR" ] || die "no encuentro $MIGRATIONS_DIR"
command -v node >/dev/null 2>&1 || die "hace falta Node (>= 22) y npx"
command -v npx >/dev/null 2>&1 || die "hace falta npx (viene con Node)"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/kultura-db-diff.XXXXXX")"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

require_docker() {
  command -v docker >/dev/null 2>&1 || die "este modo necesita Docker (no está instalado). Sin Docker: scripts/db-diff.sh --types"
  docker info >/dev/null 2>&1 || die "Docker no responde (¿Docker Desktop arrancado?). Sin Docker: scripts/db-diff.sh --types"
}

# URL para node-postgres: con sslmode=require si apunta fuera de esta máquina
# (Supabase acepta TLS; postgres-meta no verifica el certificado con require).
pg_url() {
  local url="$DB_URL"
  case "$url" in
    *sslmode=*|*@localhost[:/]*|*@127.0.0.1[:/]*) ;;
    *\?*) url="$url&sslmode=require" ;;
    *) url="$url?sslmode=require" ;;
  esac
  printf '%s' "$url"
}

# Escribe en $1 los tipos de la base (formato de `supabase gen types typescript`).
generate_types() {
  local out="$1"
  if [ "$GENERATOR" = "cli" ]; then
    require_docker
    npx --yes "supabase@$SUPABASE_CLI_VERSION" gen types typescript \
      --db-url "$DB_URL" --schema "$SCHEMA" >"$out" 2>"$WORK/gen.err" \
      || { cat "$WORK/gen.err" >&2; die "supabase gen types ha fallado"; }
  else
    echo "· Instalando postgres-meta $PGMETA_VERSION en un directorio temporal…" >&2
    npm install --prefix "$WORK/pgmeta" --no-save --no-audit --no-fund --ignore-scripts \
      --loglevel=error "@supabase/postgres-meta@$PGMETA_VERSION" >/dev/null 2>"$WORK/npm.err" \
      || { cat "$WORK/npm.err" >&2; die "no se pudo instalar @supabase/postgres-meta@$PGMETA_VERSION"; }
    PG_META_DB_URL="$(pg_url)" \
    PG_META_GENERATE_TYPES=typescript \
    PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS="$SCHEMA" \
    PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS=true \
      node "$WORK/pgmeta/node_modules/@supabase/postgres-meta/dist/server/server.js" \
      >"$out" 2>"$WORK/gen.err" \
      || { grep -v MaxListeners "$WORK/gen.err" >&2 || true; die "postgres-meta no ha podido leer la base (¿URL o contraseña?)"; }
  fi
  grep -q '^export type Database = {' "$out" || { cat "$WORK/gen.err" >&2 || true; die "la salida del generador no contiene 'export type Database'"; }
}

check_marks() {
  [ "$(grep -cxF "$BEGIN_MARK — generado; no editar a mano (scripts/db-diff.sh --gen-types)" "$TYPES_FILE")" = 1 ] \
    && [ "$(grep -cxF "$END_MARK" "$TYPES_FILE")" = 1 ] \
    || die "src/types/supabase.ts no tiene exactamente una pareja de marcas $BEGIN_MARK … $END_MARK"
}

# Extrae a $1 el bloque generado que hay ahora en src/types/supabase.ts.
current_block() {
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
    index($0, b) == 1 { inside = 1; next }
    $0 == e { inside = 0 }
    inside { print }' "$TYPES_FILE" >"$1"
}

case "$MODE" in
  diff)
    require_docker
    # El repo no tiene supabase/config.toml: se monta un proyecto mínimo en un
    # directorio temporal con una copia de las migraciones.
    mkdir -p "$WORK/supabase/migrations"
    cp "$MIGRATIONS_DIR"/*.sql "$WORK/supabase/migrations/"
    cat >"$WORK/supabase/config.toml" <<EOF
project_id = "kultura-db-diff"

[db]
port = 54399
shadow_port = 54398
major_version = $PG_MAJOR

[db.seed]
enabled = false
EOF
    echo "· Comparando $(ls "$WORK/supabase/migrations" | wc -l | tr -d ' ') migraciones con la base (esquema: $SCHEMA, Postgres $PG_MAJOR)…" >&2
    if ! npx --yes "supabase@$SUPABASE_CLI_VERSION" db diff --workdir "$WORK" \
        --db-url "$DB_URL" --schema "$SCHEMA" >"$WORK/diff.sql" 2>"$WORK/diff.err"; then
      cat "$WORK/diff.err" >&2
      die "supabase db diff ha fallado (mira el error de arriba)"
    fi
    # Deriva = cualquier línea que no sea vacía ni comentario.
    if grep -Ev '^[[:space:]]*(--.*)?$' "$WORK/diff.sql" >/dev/null; then
      echo "DERIVA DETECTADA: la base tiene cambios que no están en supabase/migrations."
      echo "SQL para llevar las migraciones al estado de la base (revisar a mano):"
      echo "------------------------------------------------------------"
      cat "$WORK/diff.sql"
      echo "------------------------------------------------------------"
      echo "Si aparecen DROP de objetos que crea una migración del repo, esa migración"
      echo "todavía no está aplicada en esta base (ver supabase/README.md)."
      exit 1
    fi
    echo "SIN DERIVA: la base coincide con supabase/migrations (esquema $SCHEMA, supabase $SUPABASE_CLI_VERSION)."
    ;;

  types)
    check_marks
    generate_types "$WORK/remote.ts"
    current_block "$WORK/local.ts"
    # Se ignoran espacios y saltos de línea (cambian entre versiones del formateador).
    if [ "$(tr -d '[:space:]' <"$WORK/remote.ts")" = "$(tr -d '[:space:]' <"$WORK/local.ts")" ]; then
      echo "SIN DERIVA de tipos: src/types/supabase.ts coincide con la base (postgres-meta $PGMETA_VERSION)."
      exit 0
    fi
    echo "DERIVA DETECTADA en los tipos ('<' = repo, '>' = base):"
    diff "$WORK/local.ts" "$WORK/remote.ts" || true
    echo "Si en '>' faltan tablas o columnas de una migración del repo, esa migración"
    echo "todavía no está aplicada en esta base (ver supabase/README.md)."
    exit 1
    ;;

  gen)
    check_marks
    generate_types "$WORK/remote.ts"
    awk -v b="$BEGIN_MARK" -v e="$END_MARK" -v gen="$WORK/remote.ts" '
      index($0, b) == 1 { print; while ((getline line < gen) > 0) print line; skip = 1; next }
      $0 == e { skip = 0 }
      !skip { print }' "$TYPES_FILE" >"$WORK/types.ts"
    cp "$WORK/types.ts" "$TYPES_FILE"
    echo "Tipos regenerados en src/types/supabase.ts (generador: $GENERATOR)."
    echo "Siguiente paso: npx tsc --noEmit (si un tipo Db* no cuadra con su tabla, falla nombrando la columna)."
    ;;
esac
