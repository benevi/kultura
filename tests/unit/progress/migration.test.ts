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

  it('escritor antiguo (solo cambia el jsonb): temporada y episodio salen de él; el resto solo si trae la clave', () => {
    const start = code.indexOf('if not cols_changed and json_changed then')
    const end = code.indexOf('cols_changed := true;', start)
    const branch = code.slice(start, end)
    expect(start).toBeGreaterThan(-1)
    // Nada se pone a NULL en bloque (un jsonb null de un libro no borra sus páginas).
    expect(branch).not.toMatch(/progress_(chapter|volume|page|percent|hours) := null/)
    for (const key of ['chapter', 'volume', 'page', 'percent', 'hours']) {
      const guard = branch.indexOf(`if j ? '${key}' then`)
      expect(guard, key).toBeGreaterThan(-1)
      expect(branch.indexOf(`new.progress_${key} :=`), key).toBeGreaterThan(guard)
    }
    // Cambio de temporada sin total en el jsonb → el total (de otra temporada) a NULL.
    expect(branch).toMatch(
      /elsif tg_op = 'UPDATE' and new\.progress_season is distinct from old\.progress_season then\s+new\.progress_total := null;/
    )
  })

  it('el disparador no es SECURITY DEFINER (corre con la RLS de quien escribe)', () => {
    expect(code).not.toMatch(/security definer/i)
  })
})
