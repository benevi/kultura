// Saneamiento 12.1: una migración que borra una columna no puede dejar
// funciones que todavía la usan. Postgres no lo impide: el cuerpo de una
// función plpgsql/sql no crea dependencia, así que el `drop column` pasa y la
// función revienta después, en producción, la primera vez que se llama.
// (Vistas y políticas sí bloquean el `drop`; con CASCADE desaparecen sin
// aviso, por eso CASCADE está prohibido aquí.)
//
// Uso (CI, con todas las migraciones ya aplicadas en un Supabase local):
//   node scripts/check-dropped-columns.mjs postgresql://postgres:postgres@127.0.0.1:54322/postgres
//
// Para cada `drop column` de cualquier migración: si la columna no ha vuelto a
// crearse, falla si el cuerpo de alguna función de la base nombra la tabla y
// la columna. Un falso positivo se acepta con un comentario en la migración:
//   -- drop-column-ok: tabla.columna <motivo>
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = 'supabase/migrations'

const IDENT = String.raw`"?([a-z_][a-z0-9_]*)"?`
const ALTER = new RegExp(
  String.raw`alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:"?public"?\.)?${IDENT}([^;]*);`,
  'gi',
)
const DROP = new RegExp(String.raw`drop\s+column\s+(?:if\s+exists\s+)?${IDENT}(\s+cascade)?`, 'gi')
const OK = /--\s*drop-column-ok:\s*([a-z0-9_]+)\.([a-z0-9_]+)/gi

/** Quita los comentarios `-- …` (salvo las marcas drop-column-ok, que se leen antes). */
function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '')
}

/**
 * Columnas borradas en una migración: [{ table, column, cascade }].
 * También las que van dentro de un bloque `do $$ … $$`.
 */
export function parseDroppedColumns(sql) {
  const out = []
  for (const [, table, rest] of stripComments(sql).matchAll(ALTER)) {
    for (const [, column, cascade] of rest.matchAll(DROP)) {
      out.push({ table: table.toLowerCase(), column: column.toLowerCase(), cascade: Boolean(cascade) })
    }
  }
  return out
}

/** Marcas `-- drop-column-ok: tabla.columna` de una migración. */
export function parseAllowed(sql) {
  return [...sql.matchAll(OK)].map(([, t, c]) => `${t.toLowerCase()}.${c.toLowerCase()}`)
}

const word = (w) => new RegExp(String.raw`(^|[^a-z0-9_])${w}([^a-z0-9_]|$)`, 'i')

/**
 * Problemas (vacío si todo bien).
 * drops: [{ file, table, column, cascade }]
 * db: { columns: Set<'tabla.columna'>, functions: [{ name, body }] }
 * allowed: Set<'tabla.columna'>
 */
export function checkDroppedColumns(drops, db, allowed = new Set()) {
  const problems = []
  for (const { file, table, column, cascade } of drops) {
    const key = `${table}.${column}`
    if (cascade) problems.push(`${file}: drop column ${key} con CASCADE (borra vistas, índices o políticas sin avisar)`)
    if (db.columns.has(key) || allowed.has(key)) continue
    for (const fn of db.functions) {
      if (word(column).test(fn.body) && word(table).test(fn.body)) {
        problems.push(`${file}: la función ${fn.name} todavía usa ${key}, que ya no existe`)
      }
    }
  }
  return problems
}

const QUERY = `
select json_build_object(
  'columns', (select coalesce(json_agg(table_name || '.' || column_name), '[]')
              from information_schema.columns where table_schema = 'public'),
  'functions', (select coalesce(json_agg(json_build_object('name', n.nspname || '.' || p.proname, 'body', p.prosrc)), '[]')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public'
                  and p.prolang in (select oid from pg_language where lanname in ('sql', 'plpgsql'))
                  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'))
)`

function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Uso: node scripts/check-dropped-columns.mjs <postgresql://… de una base con todas las migraciones>')
    process.exit(2)
  }
  const drops = []
  const allowed = new Set()
  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    for (const d of parseDroppedColumns(sql)) drops.push({ file, ...d })
    for (const a of parseAllowed(sql)) allowed.add(a)
  }
  const raw = execFileSync('psql', [url, '-AtX', '-v', 'ON_ERROR_STOP=1', '-c', QUERY], { encoding: 'utf8' })
  const parsed = JSON.parse(raw)
  const db = { columns: new Set(parsed.columns), functions: parsed.functions }
  const problems = checkDroppedColumns(drops, db, allowed)
  if (problems.length > 0) {
    for (const p of problems) console.error(`::error::${p}`)
    console.error('Arregla la función en la misma migración (o antes), o marca un falso positivo con: -- drop-column-ok: tabla.columna <motivo>')
    process.exit(1)
  }
  console.log(`OK: ${drops.length} columnas borradas, ninguna función las usa (${db.functions.length} funciones revisadas).`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
