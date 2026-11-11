// Saneamiento 2.12: las migraciones nuevas van DESPUÉS de todas las que ya hay
// en la rama base. Una migración con fecha anterior a la última aplicada se
// queda sin aplicar en producción sin que nadie lo note (`supabase db push`
// solo aplica las que van por detrás de la última, y a mano se salta).
//
// Uso: node scripts/check-migration-order.mjs <ref de la rama base>
//   (en CI: git fetch --depth=1 origin master && node … FETCH_HEAD)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const MIGRATIONS_DIR = 'supabase/migrations'
const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/

/**
 * Devuelve los problemas (vacío si todo está bien) al comparar las migraciones
 * de la rama base con las de la rama nueva. Solo se miran los ficheros .sql.
 */
export function checkMigrationOrder(baseNames, headNames) {
  const sql = (names) => names.filter((n) => n.endsWith('.sql'))
  const base = new Set(sql(baseNames))
  const head = sql(headNames)
  const problems = []

  const lastBase = [...base]
    .map((n) => n.match(NAME)?.[1])
    .filter(Boolean)
    .sort()
    .at(-1)

  const seen = new Map()
  for (const name of head) {
    const ts = name.match(NAME)?.[1]
    if (!ts) {
      if (!base.has(name)) problems.push(`${name}: el nombre debe ser AAAAMMDDHHMMSS_nombre_en_minusculas.sql`)
      continue
    }
    if (seen.has(ts)) problems.push(`${name}: misma fecha que ${seen.get(ts)}`)
    seen.set(ts, name)
    if (!base.has(name) && lastBase && ts <= lastBase) {
      problems.push(`${name}: es nueva pero su fecha no es posterior a la última de la base (${lastBase})`)
    }
  }
  return problems
}

function main() {
  const ref = process.argv[2]
  if (!ref) {
    console.error('Uso: node scripts/check-migration-order.mjs <ref de la rama base>')
    process.exit(2)
  }
  const baseNames = execFileSync('git', ['ls-tree', '--name-only', `${ref}:${MIGRATIONS_DIR}`], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
  const headNames = fs.readdirSync(MIGRATIONS_DIR)
  const problems = checkMigrationOrder(baseNames, headNames)
  if (problems.length > 0) {
    console.error('Migraciones fuera de orden:\n' + problems.map((p) => `  - ${p}`).join('\n'))
    process.exit(1)
  }
  console.log(`Migraciones en orden (${headNames.length} ficheros).`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main()
