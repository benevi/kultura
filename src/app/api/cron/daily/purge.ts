// ============================================================
// KULTURA — Purga de cuentas con el borrado vencido (ROJO-7)
//
// Las cuentas que pidieron borrarse hace 7 días o más (account_state.
// deletion_requested_at) se borran de verdad: traspaso de grupos y listas
// colaborativas y después el usuario de Auth. Se ejecuta siempre, aunque
// ACCOUNT_GRACE se haya desactivado después: un borrado pedido se cumple.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteAccountNow, isNotMigrated } from '@/app/api/settings/account-state'
import { ACCOUNT_GRACE_DAYS } from '@/app/api/settings/identity'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron/purge')

/** Tope por ejecución: el plan Hobby corta la función a los 60 s. */
export const MAX_PURGE_PER_RUN = 25

export interface PurgeResult {
  status: 'done' | 'not_migrated' | 'error'
  deleted: number
  failed: number
}

export async function purgeExpiredAccounts(admin: SupabaseClient, now = new Date()): Promise<PurgeResult> {
  const cutoff = new Date(now.getTime() - ACCOUNT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('account_state')
    .select('user_id')
    .not('deletion_requested_at', 'is', null)
    .lte('deletion_requested_at', cutoff)
    .order('deletion_requested_at', { ascending: true })
    .limit(MAX_PURGE_PER_RUN)

  if (error) {
    if (isNotMigrated(error)) return { status: 'not_migrated', deleted: 0, failed: 0 }
    log.error(`purga: no se pudo leer account_state · ${error.message}`)
    return { status: 'error', deleted: 0, failed: 0 }
  }

  let deleted = 0
  let failed = 0
  for (const row of (data ?? []) as Array<{ user_id: string }>) {
    const result = await deleteAccountNow(admin, row.user_id)
    if (result.ok) deleted++
    else {
      failed++
      log.error(`purga: no se pudo borrar ${row.user_id} (${result.step}) · ${result.message}`)
    }
  }
  return { status: 'done', deleted, failed }
}
