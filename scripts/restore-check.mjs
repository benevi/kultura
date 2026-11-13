// Saneamiento 12.6: prueba de restauración de cada copia (backup.yml).
//
//   node scripts/restore-check.mjs prepare <carpeta>
//     Lee <carpeta>/data.sql (volcado de `supabase db dump --data-only
//     --use-copy`) y escribe <carpeta>/data_restore.sql solo con los COPY de
//     public.*, auth.users y auth.identities (las imágenes locales de Auth y
//     Storage pueden ir por detrás de producción) y <carpeta>/expected.json
//     con las filas de cada tabla según el volcado.
//
//   node scripts/restore-check.mjs verify <carpeta> <postgresql://…>
//     Cuenta las filas de cada tabla en la base restaurada y falla si alguna
//     no coincide con expected.json. Solo imprime nombres de tabla y números.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const KEEP = (schema, table) =>
  schema === 'public' || (schema === 'auth' && (table === 'users' || table === 'identities'))

/** De data.sql: { sql: lo que se carga, expected: { 'esquema.tabla': filas } }. */
export function prepareData(data) {
  const lines = data.replace(/\r\n/g, '\n').split('\n')
  const out = []
  const expected = {}
  let current = null // { key, keep }
  for (const l of lines) {
    if (current === null) {
      const m = l.match(/^COPY "(\w+)"\."(\w+)"/)
      if (m) {
        current = { key: `${m[1]}.${m[2]}`, keep: KEEP(m[1], m[2]) }
        if (current.keep) {
          expected[current.key] = 0
          out.push(l)
        }
        continue
      }
      if (/^SET /.test(l) || /^SELECT pg_catalog\.setval\('"public"/.test(l)) out.push(l)
    } else if (l === '\\.') {
      if (current.keep) out.push(l)
      current = null
    } else if (current.keep) {
      out.push(l)
      expected[current.key]++
    }
  }
  return { sql: out.join('\n') + '\n', expected }
}

/** Diferencias entre lo esperado y lo restaurado (vacío si cuadra). */
export function compareCounts(expected, actual) {
  const problems = []
  for (const [table, rows] of Object.entries(expected)) {
    if (!(table in actual)) problems.push(`${table}: no existe en la base restaurada`)
    else if (actual[table] !== rows) problems.push(`${table}: ${actual[table]} filas restauradas, ${rows} en la copia`)
  }
  return problems
}

function main() {
  const [mode, dir, url] = process.argv.slice(2)
  if (mode === 'prepare' && dir) {
    const { sql, expected } = prepareData(fs.readFileSync(path.join(dir, 'data.sql'), 'utf8'))
    fs.writeFileSync(path.join(dir, 'data_restore.sql'), sql)
    fs.writeFileSync(path.join(dir, 'expected.json'), JSON.stringify(expected, null, 2))
    const total = Object.values(expected).reduce((a, b) => a + b, 0)
    console.log(`Copia: ${Object.keys(expected).length} tablas, ${total} filas.`)
    return
  }
  if (mode === 'verify' && dir && url) {
    const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'))
    const actual = {}
    for (const table of Object.keys(expected)) {
      const [schema, name] = table.split('.')
      try {
        const out = execFileSync('psql', [url, '-AtX', '-c', `select count(*) from "${schema}"."${name}"`], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        })
        actual[table] = Number(out.trim())
      } catch {
        // La tabla no existe: compareCounts lo cuenta como fallo.
      }
    }
    const problems = compareCounts(expected, actual)
    for (const [table, rows] of Object.entries(expected)) console.log(`${table}: ${rows}`)
    if (problems.length > 0) {
      for (const p of problems) console.error(`::error::${p}`)
      process.exit(1)
    }
    console.log(`OK: ${Object.keys(expected).length} tablas restauradas con las mismas filas que la copia.`)
    return
  }
  console.error('Uso: node scripts/restore-check.mjs prepare <carpeta> | verify <carpeta> <postgresql://…>')
  process.exit(2)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
