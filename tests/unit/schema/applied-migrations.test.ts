// ============================================================
// KULTURA — Saneamiento 12.1: migraciones aplicadas frente al repo
// scripts/check-applied-migrations.mjs (a mano contra prod o kultura-test).
// ============================================================

import { describe, it, expect } from 'vitest'
import { compareApplied, repoMigrationNames } from '../../../scripts/check-applied-migrations.mjs'

const FILES = ['20261231000002_b.sql', '20261231000001_a.sql', 'README.md', '20261231000003_push.sql']

describe('repoMigrationNames', () => {
  it('quita la fecha, ignora lo que no es migración y ordena', () => {
    expect(repoMigrationNames(FILES)).toEqual(['a', 'b', 'push'])
  })
})

describe('compareApplied', () => {
  const repo = ['a', 'b', 'push']

  it('compara por nombre aunque la versión sea la fecha de aplicación (MCP)', () => {
    const applied = [{ version: '20261111083414', name: 'a' }, { version: '20261111090628', name: 'b' }]
    expect(compareApplied(repo, applied, ['push'])).toEqual({
      unknown: [],
      duplicated: [],
      pendingExpected: ['push'],
      pendingUnexpected: [],
    })
  })

  it('detecta pendientes inesperadas, repetidas y las que no están en el repo', () => {
    const applied = [
      { version: '1', name: 'a' },
      { version: '2', name: 'a' },
      { version: '3', name: 'hecha_a_mano' },
    ]
    const r = compareApplied(repo, applied)
    expect(r.pendingUnexpected).toEqual(['b', 'push'])
    expect(r.duplicated).toEqual(['a'])
    expect(r.unknown).toEqual(['3_hecha_a_mano'])
  })
})
