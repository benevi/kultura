// ============================================================
// KULTURA — Saneamiento 2.12: orden de las migraciones
// scripts/check-migration-order.mjs (corre en CI contra la rama base).
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { checkMigrationOrder, MIGRATIONS_DIR } from '../../../scripts/check-migration-order.mjs'

const BASE = ['20261229340001_a.sql', '20261229350001_b.sql', 'README.md']

describe('checkMigrationOrder', () => {
  it('una migración nueva con fecha posterior a la última de la base pasa', () => {
    expect(checkMigrationOrder(BASE, [...BASE, '20261230000001_c.sql'])).toEqual([])
  })

  it('sin cambios pasa (aunque la base tenga fechas viejas)', () => {
    expect(checkMigrationOrder(BASE, BASE)).toEqual([])
  })

  it('una migración nueva con fecha anterior a la última de la base falla', () => {
    const problems = checkMigrationOrder(BASE, [...BASE, '20261229345000_tarde.sql'])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/20261229345000_tarde\.sql.*20261229350001/)
  })

  it('una nueva con la misma fecha que la última de la base falla', () => {
    const problems = checkMigrationOrder(BASE, [...BASE, '20261229350001_otra.sql'])
    expect(problems.some((p) => p.includes('misma fecha'))).toBe(true)
    expect(problems.some((p) => p.includes('no es posterior'))).toBe(true)
  })

  it('un nombre nuevo sin el formato falla', () => {
    expect(checkMigrationOrder(BASE, [...BASE, '2026_mal.sql'])).toHaveLength(1)
    expect(checkMigrationOrder(BASE, [...BASE, '20261230000001_Mayus.sql'])).toHaveLength(1)
  })

  it('ignora lo que no es .sql', () => {
    expect(checkMigrationOrder(BASE, [...BASE, 'notas.md'])).toEqual([])
  })
})

describe('supabase/migrations', () => {
  it('cumple el formato y no repite fechas', () => {
    const names = fs.readdirSync(path.resolve(MIGRATIONS_DIR))
    expect(checkMigrationOrder([], names)).toEqual([])
  })
})
