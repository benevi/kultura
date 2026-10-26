// ============================================================
// KULTURA — Preferencias del correo semanal (F-28) · solo servidor
// Lectura con la sesión de la persona (RLS: solo su fila) y escritura por las
// funciones de la migración 20261215280001_calendar_email.sql. Sin la
// migración aplicada todo devuelve "no disponible" y nada se rompe.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { WEEKLY_EMAIL_CONSENT_VERSION } from './consent'

/** "Aún no existe" (tabla, columna, función o caché de esquema de PostgREST). */
const NOT_MIGRATED = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

export function isEmailNotMigrated(error: { code?: string | null } | null | undefined): boolean {
  return !!error && NOT_MIGRATED.has(error.code ?? '')
}

export interface WeeklyEmailPreference {
  weekly: boolean
  consentVersion: string | null
  consentedAt: string | null
}

/** La preferencia de la persona; `null` si la tabla aún no existe o falla la lectura. */
export async function readWeeklyEmailPreference(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string
): Promise<WeeklyEmailPreference | null> {
  const { data, error } = await supabase
    .from('email_preferences')
    .select('weekly_digest, consent_version, consented_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  const row = data as { weekly_digest?: boolean; consent_version?: string | null; consented_at?: string | null } | null
  return {
    weekly: row?.weekly_digest === true,
    consentVersion: row?.consent_version ?? null,
    consentedAt: row?.consented_at ?? null,
  }
}

export type SetWeeklyResult =
  | { ok: true; preference: WeeklyEmailPreference }
  | { ok: false; reason: 'not_migrated' | 'forbidden' | 'error' }

/** Alta o baja con la sesión de la persona (`set_email_weekly`, registra el consentimiento). */
export async function setWeeklyEmail(
  supabase: Pick<SupabaseClient, 'rpc'>,
  enabled: boolean
): Promise<SetWeeklyResult> {
  const { data, error } = await supabase.rpc('set_email_weekly', {
    p_enabled: enabled,
    p_text_version: WEEKLY_EMAIL_CONSENT_VERSION,
    p_source: 'settings',
  })
  if (error) {
    if (isEmailNotMigrated(error)) return { ok: false, reason: 'not_migrated' }
    if (error.code === '42501') return { ok: false, reason: 'forbidden' }
    return { ok: false, reason: 'error' }
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { weekly_digest?: boolean; consent_version?: string | null; consented_at?: string | null }
    | null
  return {
    ok: true,
    preference: {
      weekly: row?.weekly_digest === true,
      consentVersion: row?.consent_version ?? null,
      consentedAt: row?.consented_at ?? null,
    },
  }
}

export type UnsubscribeResult = { ok: true; changed: boolean } | { ok: false; reason: 'not_migrated' | 'error' }

/** Baja sin sesión (enlace firmado ya verificado). Idempotente. Cliente admin. */
export async function unsubscribeWeekly(
  admin: Pick<SupabaseClient, 'rpc'>,
  userId: string,
  source: 'unsubscribe_page' | 'one_click'
): Promise<UnsubscribeResult> {
  const { data, error } = await admin.rpc('email_unsubscribe', { p_user: userId, p_source: source })
  if (error) return { ok: false, reason: isEmailNotMigrated(error) ? 'not_migrated' : 'error' }
  return { ok: true, changed: data === true }
}
