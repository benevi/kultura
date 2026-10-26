// ============================================================
// F-27 · La migración 20261215270001 dice lo mismo que el código (rangos de
// los CHECK = PROGRESS_LIMITS) y es repetible. La prueba de verdad (aplicarla
// dos veces sobre PostgreSQL 16 con datos de antes) está descrita en el PR.
// ============================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { PROGRESS_LIMITS } from '@/lib/library/progress'

const SQL = readFileSync(
  path.resolve(__dirname, '../../../supabase/migrations/20261215270001_progress.sql'),
  'utf8'
)
const code = SQL.replace(/--[^\n]*/g, '')

describe('migración de progreso', () => {
  it('cada CHECK usa el mismo rango que el código', () => {
    for (const [field, lim] of Object.entries(PROGRESS_LIMITS)) {
      const re = new RegExp(`progress_${field} is null or progress_${field} between ([\\d.]+) and ([\\d.]+)`)
      const m = code.match(re)
      expect(m, field).not.toBeNull()
      expect(Number(m![1]), field).toBe(lim.min)
      expect(Number(m![2]), field).toBe(lim.max)
    }
  })

  it('es idempotente: columnas IF NOT EXISTS, constraints comprobadas, disparador DROP … IF EXISTS', () => {
    const adds = code.match(/add column (?!if not exists)/gi) ?? []
    expect(adds).toHaveLength(0)
    expect(code).toMatch(/if not exists \(\s*select 1 from pg_constraint/i)
    expect(code).toMatch(/drop trigger if exists user_media_sync_progress on public\.user_media/i)
    expect(code).toMatch(/create or replace function public\.user_media_sync_progress\(\)/i)
  })

  it('el relleno no toca updated_at (apaga su disparador y lo vuelve a encender)', () => {
    const off = code.indexOf('disable trigger user_media_set_updated_at')
    const on = code.indexOf('enable trigger user_media_set_updated_at')
    const fill = code.indexOf('update public.user_media u')
    expect(off).toBeGreaterThan(-1)
    expect(fill).toBeGreaterThan(off)
    expect(on).toBeGreaterThan(fill)
  })

  it('el disparador no es SECURITY DEFINER (corre con la RLS de quien escribe)', () => {
    expect(code).not.toMatch(/security definer/i)
  })
})
