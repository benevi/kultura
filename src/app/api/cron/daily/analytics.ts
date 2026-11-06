// ============================================================
// KULTURA — Retención de la analítica de producto (F-17 → F-28)
//
// Llama a public.purge_old_analytics_events() (migración
// 20261115170001_analytics.sql: borra los eventos de más de 13 meses y
// devuelve cuántos).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron/analytics')

export interface AnalyticsPurgeResult {
  status: 'done' | 'error'
  deleted: number
}

export async function purgeOldAnalytics(admin: Pick<SupabaseClient, 'rpc'>): Promise<AnalyticsPurgeResult> {
  try {
    const { data, error } = await admin.rpc('purge_old_analytics_events')
    if (error) {
      log.error(`retención de analítica: ${error.code ?? 'error'}`)
      return { status: 'error', deleted: 0 }
    }
    return { status: 'done', deleted: typeof data === 'number' ? data : 0 }
  } catch (e) {
    log.error(`retención de analítica: ${e instanceof Error ? e.message : String(e)}`)
    return { status: 'error', deleted: 0 }
  }
}
