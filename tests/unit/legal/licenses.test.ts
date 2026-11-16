// Fase 8 · 8A.0 (PLAN_FASE8 §9.8): ningún recurso sin fila en
// `assets/LICENSES.csv`. Cubre `public/`, `assets/` y las fuentes de
// `src/app/fonts/`. Una fila puede usar `*` dentro del nombre de archivo.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..')
const CSV = join(ROOT, 'assets', 'LICENSES.csv')
const COLUMNS = ['ruta', 'tipo', 'titular', 'licencia', 'origen', 'estado', 'notas']

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [relative(ROOT, full).split(sep).join('/')]
  })
}

function readRows(): string[][] {
  const lines = readFileSync(CSV, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '')
  return lines.map((l) => l.split(','))
}

function toRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`)
}

const rows = readRows()
const header = rows[0]
const entries = rows.slice(1)
const patterns = entries.map((r) => r[0])

const resources = [
  ...walk(join(ROOT, 'public')),
  ...walk(join(ROOT, 'assets')).filter((f) => f !== 'assets/LICENSES.csv'),
  ...walk(join(ROOT, 'src', 'app', 'fonts')).filter((f) => !/\.(ts|tsx)$/.test(f)),
]

describe('assets/LICENSES.csv', () => {
  it('tiene las columnas esperadas y todas las filas completas', () => {
    expect(header).toEqual(COLUMNS)
    for (const row of entries) {
      expect(row, row.join(',')).toHaveLength(COLUMNS.length)
      // Ruta, titular, licencia y estado no pueden quedar vacíos.
      for (const i of [0, 2, 3, 5]) expect(row[i].trim(), `${row[0]}: ${COLUMNS[i]}`).not.toBe('')
    }
  })

  it('cada recurso de public/, assets/ y src/app/fonts/ tiene su fila', () => {
    const regexps = patterns.map(toRegExp)
    const missing = resources.filter((f) => !regexps.some((re) => re.test(f)))
    expect(missing).toEqual([])
  })

  it('ninguna fila apunta a un archivo que ya no existe', () => {
    const stale = patterns.filter((p) => !resources.some((f) => toRegExp(p).test(f)))
    expect(stale).toEqual([])
  })

  it('NOTICE existe y remite a la lista', () => {
    const notice = readFileSync(join(ROOT, 'NOTICE'), 'utf8')
    expect(notice).toContain('assets/LICENSES.csv')
    expect(notice).toContain('SIL Open Font License')
  })
})
