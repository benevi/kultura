// ============================================================
// KULTURA — Saneamiento 12.3: banderas con caducidad
// scripts/check-flags.mjs (corre en CI).
// ============================================================

import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import { checkFlags, flagsInCode, REGISTRY } from '../../../scripts/check-flags.mjs'

const files = [
  { path: 'a.ts', text: "return process.env.FOO_V2 === '1'" },
  { path: 'b.ts', text: 'if (env.BAR?.trim() !== "1") return' },
  { path: 'c.ts', text: 'const flag = env.PUSHY?.trim()' },
]

describe('flagsInCode', () => {
  it('encuentra las comparaciones con "1", con o sin trim', () => {
    expect([...flagsInCode(files)].sort()).toEqual(['BAR', 'FOO_V2'])
  })
})

describe('checkFlags', () => {
  const reg = [
    { nombre: 'FOO_V2', desde: '2026-10-01' },
    { nombre: 'BAR', desde: '2026-10-01' },
    { nombre: 'PUSHY', desde: '2026-10-01' },
  ]

  it('pasa con todo registrado y dentro de plazo', () => {
    expect(checkFlags(reg, files, '2026-11-30')).toEqual([])
  })

  it('falla a los 61 días, salvo las permanentes', () => {
    const problems = checkFlags(reg, files, '2026-12-01')
    expect(problems).toHaveLength(3)
    expect(problems[0]).toMatch(/FOO_V2: lleva 61 días/)
    const withPermanent = reg.map((f) => (f.nombre === 'BAR' ? { ...f, permanente: 'interruptor' } : f))
    expect(checkFlags(withPermanent, files, '2026-12-01')).toHaveLength(2)
  })

  it('falla con una bandera sin registrar o una registrada que ya no existe', () => {
    const problems = checkFlags([...reg.slice(1), { nombre: 'GONE', desde: '2026-11-01' }], files, '2026-11-02')
    expect(problems).toEqual([
      `FOO_V2: bandera en el código sin registrar en ${REGISTRY}`,
      `GONE: ya no está en src/; quítala de ${REGISTRY}`,
    ])
  })

  it('el registro del repo tiene los campos que hacen falta', () => {
    const { banderas } = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
    for (const f of banderas) {
      expect(f.nombre).toMatch(/^[A-Z][A-Z0-9_]*$/)
      expect(f.dueno).toBeTruthy()
      expect(Number.isNaN(Date.parse(f.desde))).toBe(false)
      expect(['on', 'off', '?']).toContain(f.produccion)
    }
  })
})
