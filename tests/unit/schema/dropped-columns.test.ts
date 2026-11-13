// ============================================================
// KULTURA — Saneamiento 12.1: columnas borradas que una función aún usa
// scripts/check-dropped-columns.mjs (corre en CI contra Supabase local).
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  checkDroppedColumns,
  parseAllowed,
  parseDroppedColumns,
  MIGRATIONS_DIR,
} from '../../../scripts/check-dropped-columns.mjs'

describe('parseDroppedColumns', () => {
  it('lee drop column con esquema, if exists y varias en un alter', () => {
    const sql = `
      alter table public.user_media drop column if exists score;
      ALTER TABLE "users" DROP COLUMN a, DROP COLUMN IF EXISTS b CASCADE;
      alter table x add column y int;`
    expect(parseDroppedColumns(sql)).toEqual([
      { table: 'user_media', column: 'score', cascade: false },
      { table: 'users', column: 'a', cascade: false },
      { table: 'users', column: 'b', cascade: true },
    ])
  })

  it('ignora los comentarios', () => {
    expect(parseDroppedColumns('-- alter table t drop column c;\nselect 1;')).toEqual([])
  })

  it('lee las marcas drop-column-ok', () => {
    expect(parseAllowed('-- drop-column-ok: users.foo otra tabla')).toEqual(['users.foo'])
  })
})

describe('checkDroppedColumns', () => {
  const drop = { file: 'm.sql', table: 'user_media', column: 'score', cascade: false }
  const fn = (body: string) => ({ name: 'public.f', body })

  it('falla si una función nombra la tabla y la columna borrada', () => {
    const db = { columns: new Set<string>(), functions: [fn('update user_media set score = 1')] }
    expect(checkDroppedColumns([drop], db)).toEqual([
      'm.sql: la función public.f todavía usa user_media.score, que ya no existe',
    ])
  })

  it('pasa si la función no nombra la tabla (otra tabla con la misma columna)', () => {
    const db = { columns: new Set<string>(), functions: [fn('select score from reviews')] }
    expect(checkDroppedColumns([drop], db)).toEqual([])
  })

  it('no confunde partes de palabra (scores, user_media_x)', () => {
    const db = { columns: new Set<string>(), functions: [fn('select scores from user_media_x')] }
    expect(checkDroppedColumns([drop], db)).toEqual([])
  })

  it('pasa si la columna se volvió a crear o está marcada como falso positivo', () => {
    const db = { columns: new Set(['user_media.score']), functions: [fn('update user_media set score = 1')] }
    expect(checkDroppedColumns([drop], db)).toEqual([])
    const db2 = { columns: new Set<string>(), functions: db.functions }
    expect(checkDroppedColumns([drop], db2, new Set(['user_media.score']))).toEqual([])
  })

  it('CASCADE siempre falla', () => {
    const db = { columns: new Set<string>(), functions: [] }
    expect(checkDroppedColumns([{ ...drop, cascade: true }], db)[0]).toMatch(/CASCADE/)
  })
})

describe('migraciones del repo', () => {
  it('ninguna borra una columna con CASCADE', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    const cascades = files.flatMap((f) =>
      parseDroppedColumns(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
        .filter((d) => d.cascade)
        .map((d) => `${f}: ${d.table}.${d.column}`),
    )
    expect(cascades).toEqual([])
  })

  it('se detectan los drops conocidos', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261231000005_drop_episode_progress.sql'), 'utf8')
    expect(parseDroppedColumns(sql).map((d) => d.column)).toEqual(['episode_progress', 'progress_updated_at'])
  })
})
