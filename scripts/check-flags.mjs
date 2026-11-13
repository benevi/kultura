// Saneamiento 12.3: banderas con caducidad.
//
// docs/banderas.json registra cada bandera de entorno (dueño, desde cuándo,
// estado en producción). Falla si:
//   - el código compara una variable de entorno con '1' y no está registrada;
//   - una registrada ya no aparece en src/ (quitarla del registro);
//   - una no permanente lleva más de 60 días: se quita la bandera (un solo
//     camino en el código) o se renueva cambiando `desde`, con motivo.
//
// Uso: node scripts/check-flags.mjs [AAAA-MM-DD]   (por defecto, hoy)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REGISTRY = 'docs/banderas.json'
export const MAX_DAYS = 60
const DAY = 24 * 60 * 60 * 1000

// `process.env.X === '1'`, `env.X?.trim() !== "1"`…
const FLAG_CHECK = /\benv\.([A-Z][A-Z0-9_]*)(?:\?\.trim\(\))?\s*[!=]==\s*['"]1['"]/g

/** Banderas que el código compara con '1'. files: [{ path, text }] */
export function flagsInCode(files) {
  const found = new Set()
  for (const { text } of files) for (const [, name] of text.matchAll(FLAG_CHECK)) found.add(name)
  return found
}

/**
 * registry: [{ nombre, desde, permanente? }]; files: [{ path, text }]; today: 'AAAA-MM-DD'
 */
export function checkFlags(registry, files, today) {
  const problems = []
  const names = new Set(registry.map((f) => f.nombre))
  const all = files.map((f) => f.text).join('\n')

  for (const name of flagsInCode(files)) {
    if (!names.has(name)) problems.push(`${name}: bandera en el código sin registrar en ${REGISTRY}`)
  }
  for (const f of registry) {
    if (!new RegExp(String.raw`\b${f.nombre}\b`).test(all)) {
      problems.push(`${f.nombre}: ya no está en src/; quítala de ${REGISTRY}`)
      continue
    }
    if (f.permanente) continue
    const days = Math.floor((Date.parse(today) - Date.parse(f.desde)) / DAY)
    if (Number.isNaN(days)) problems.push(`${f.nombre}: fecha \`desde\` no válida (${f.desde})`)
    else if (days > MAX_DAYS) {
      problems.push(`${f.nombre}: lleva ${days} días (máximo ${MAX_DAYS}). Quita la bandera o renueva \`desde\` con motivo`)
    }
  }
  return problems
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return /\.(ts|tsx|js|mjs)$/.test(e.name) ? [{ path: p, text: fs.readFileSync(p, 'utf8') }] : []
  })
}

function main() {
  const today = process.argv[2] ?? new Date().toISOString().slice(0, 10)
  const { banderas } = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
  const problems = checkFlags(banderas, walk('src'), today)
  if (problems.length > 0) {
    for (const p of problems) console.error(`::error::${p}`)
    process.exit(1)
  }
  const unknown = banderas.filter((f) => f.produccion === '?').map((f) => f.nombre)
  console.log(`OK: ${banderas.length} banderas registradas, ninguna caducada (${today}).`)
  if (unknown.length) console.log(`Sin comprobar en producción: ${unknown.join(', ')}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
