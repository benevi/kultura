// Saneamiento 12.1: ¿qué migraciones del repo están aplicadas en una base?
//
// Compara supabase/migrations/*.sql con supabase_migrations.schema_migrations
// de producción o de kultura-test. Se compara por NOMBRE, no por versión: al
// aplicar con el MCP de Supabase (apply_migration) la versión que queda es la
// fecha de aplicación, no la del archivo.
//
// Uso (a mano; nunca en el CI, que no tiene las URLs):
//   node scripts/check-applied-migrations.mjs --db-url "$SUPABASE_DB_URL"
//   node scripts/check-applied-migrations.mjs --json aplicadas.json
//     (aplicadas.json: [{ "version": "…", "name": "…" }] o { "migrations": [...] },
//      p. ej. la salida de list_migrations del MCP de Supabase)
//   --pending push,push_throttle   pendientes a propósito (Q14): no avisan.
//   --strict                       cualquier otra pendiente también falla.
//
// Salida: 0 = cuadra; 1 = en la base hay migraciones que no están en el repo
// (o pendientes inesperadas con --strict); 2 = error de uso. La URL nunca se
// imprime.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = 'supabase/migrations'
const FILE = /^(\d{14})_([a-z0-9_]+)\.sql$/

/** Nombres de las migraciones del repo, en orden. */
export function repoMigrationNames(files) {
  return files
    .map((f) => f.match(FILE))
    .filter(Boolean)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map((m) => m[2])
}

/**
 * repo: nombres del repo; applied: [{ version, name }] de la base;
 * expectedPending: nombres que se dejan sin aplicar a propósito.
 */
export function compareApplied(repo, applied, expectedPending = []) {
  const appliedNames = new Set(applied.map((m) => m.name))
  const repoNames = new Set(repo)
  const expected = new Set(expectedPending)
  const pending = repo.filter((n) => !appliedNames.has(n))
  return {
    unknown: applied.filter((m) => !repoNames.has(m.name)).map((m) => `${m.version}_${m.name}`),
    duplicated: [...appliedNames].filter((n) => applied.filter((m) => m.name === n).length > 1),
    pendingExpected: pending.filter((n) => expected.has(n)),
    pendingUnexpected: pending.filter((n) => !expected.has(n)),
  }
}

function readApplied({ dbUrl, json }) {
  if (json) {
    const data = JSON.parse(fs.readFileSync(json, 'utf8'))
    return Array.isArray(data) ? data : data.migrations
  }
  const out = execFileSync(
    'psql',
    [dbUrl, '-AtX', '-v', 'ON_ERROR_STOP=1', '-c',
      "select coalesce(json_agg(json_build_object('version', version, 'name', name) order by version), '[]') from supabase_migrations.schema_migrations"],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return JSON.parse(out)
}

function main() {
  const args = process.argv.slice(2)
  const opt = { pending: [], strict: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--db-url') opt.dbUrl = args[++i]
    else if (a === '--json') opt.json = args[++i]
    else if (a === '--pending') opt.pending = (args[++i] ?? '').split(',').filter(Boolean)
    else if (a === '--strict') opt.strict = true
    else {
      console.error(`Opción desconocida: ${a}`)
      process.exit(2)
    }
  }
  if (!opt.dbUrl && !opt.json) {
    console.error('Uso: node scripts/check-applied-migrations.mjs (--db-url URL | --json archivo) [--pending a,b] [--strict]')
    process.exit(2)
  }
  let applied
  try {
    applied = readApplied(opt)
  } catch {
    console.error('No se pudo leer la lista de migraciones aplicadas (¿URL, contraseña o archivo?).')
    process.exit(2)
  }
  const repo = repoMigrationNames(fs.readdirSync(MIGRATIONS_DIR))
  const r = compareApplied(repo, applied, opt.pending)

  console.log(`Repo: ${repo.length} migraciones · base: ${applied.length} aplicadas.`)
  for (const n of r.pendingExpected) console.log(`  pendiente a propósito: ${n}`)
  for (const n of r.pendingUnexpected) console.log(`  PENDIENTE: ${n}`)
  for (const n of r.duplicated) console.log(`  REPETIDA en la base: ${n}`)
  for (const n of r.unknown) console.log(`  EN LA BASE PERO NO EN EL REPO: ${n}`)

  const failed = r.unknown.length > 0 || r.duplicated.length > 0 || (opt.strict && r.pendingUnexpected.length > 0)
  console.log(failed ? 'NO CUADRA.' : 'OK.')
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
