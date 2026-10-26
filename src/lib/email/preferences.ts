// ============================================================
// KULTURA — Preferencias del correo semanal (F-28) · solo servidor
// Lectura con la sesión de la persona (RLS: solo su fila) y escritura por las
// funciones de la migración 20261215280001_calendar_email.sql. Sin la
// migración aplicada todo devuelve "no disponible" y nada se rompe.
//
// Doble opt-in: el alta se pide desde Ajustes (`requestWeeklyOptin` apunta la
// hora y se envía el enlace "optin" a la dirección de la cuenta) y solo se
// activa —y se registra el consentimiento— al pulsarlo (`confirmWeeklyOptin`,
// con el service role).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { WEEKLY_EMAIL_CONSENT_VERSION } from './consent'

/** "Aún no existe" (tabla, columna, función o caché de esquema de PostgREST). */
const NOT_MIGRATED = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

export function isEmailNotMigrated(error: { code?: string | null } | null | undefined): boolean {
  return !!error && NOT_MIGRATED.has(error.code ?? '')
}

/** Entre dos enlaces de confirmación a la misma persona (que no se use para llenarle el buzón). */
export const OPTIN_COOLDOWN_MS = 10 * 60_000

export interface WeeklyEmailPreference {
  weekly: boolean
  consentVersion: string | null
  consentedAt: string | null
  /** Última petición de confirmación (alta pendiente de pulsar el enlace). */
  optinRequestedAt: string | null
  /** Huella de la dirección que confirmó el alta (emailFingerprint). */
  confirmedEmailHash: string | null
}

/** La preferencia de la persona; `null` si la tabla aún no existe o falla la lectura. */
export async function readWeeklyEmailPreference(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string
): Promise<WeeklyEmailPreference | null> {
  const { data, error } = await supabase
    .from('email_preferences')
    .select('weekly_digest, consent_version, consented_at, optin_requested_at, confirmed_email_hash')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  const row = data as {
    weekly_digest?: boolean
    consent_version?: string | null
    consented_at?: string | null
    optin_requested_at?: string | null
    confirmed_email_hash?: string | null
  } | null
  return {
    weekly: row?.weekly_digest === true,
    consentVersion: row?.consent_version ?? null,
    consentedAt: row?.consented_at ?? null,
    optinRequestedAt: row?.optin_requested_at ?? null,
    confirmedEmailHash: row?.confirmed_email_hash ?? null,
  }
}

export type SetWeeklyResult =
  | { ok: true; preference: Omit<WeeklyEmailPreference, 'optinRequestedAt' | 'confirmedEmailHash'> }
  | { ok: false; reason: 'not_migrated' | 'forbidden' | 'error' }

/**
 * Baja con la sesión de la persona (`set_email_weekly(false)`, registra la
 * baja). El alta NO va por aquí: la base la rechaza (doble opt-in).
 */
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

export type OptinClaim = 'ok' | 'cooldown' | 'user_cap' | 'global_cap' | 'not_migrated' | 'error'

/**
 * Reserva el envío de un enlace de confirmación con los topes en la base
 * (`email_optin_claim`: 10 min entre enlaces, N al día por persona y un tope
 * global diario, en una sola transacción). No activa nada ni registra
 * consentimiento. Darse de baja no borra estos registros. Cliente admin.
 */
export async function claimWeeklyOptin(
  admin: Pick<SupabaseClient, 'rpc'>,
  userId: string,
  caps: { userDaily: number; globalDaily: number; cooldownMs?: number }
): Promise<OptinClaim> {
  const minutes = Math.max(1, Math.round((caps.cooldownMs ?? OPTIN_COOLDOWN_MS) / 60_000))
  const { data, error } = await admin.rpc('email_optin_claim', {
    p_user: userId,
    p_user_daily: caps.userDaily,
    p_global_daily: caps.globalDaily,
    p_cooldown: `${minutes} minutes`,
  })
  if (error) return isEmailNotMigrated(error) ? 'not_migrated' : 'error'
  return data === 'ok' || data === 'cooldown' || data === 'user_cap' || data === 'global_cap' ? data : 'error'
}

export type ConfirmResult =
  | { ok: true; status: 'ok' | 'unchanged' | 'superseded' }
  | { ok: false; reason: 'not_migrated' | 'error' }

/**
 * Alta confirmada desde el enlace "optin" ya verificado: aquí se registra el
 * consentimiento y la huella de la dirección confirmada. `issuedAt`: cuándo se
 * emitió el enlace (si después hubo una baja, `superseded`). Cliente admin.
 */
export async function confirmWeeklyOptin(
  admin: Pick<SupabaseClient, 'rpc'>,
  userId: string,
  textVersion: string,
  emailHash: string,
  issuedAt: Date
): Promise<ConfirmResult> {
  const { data, error } = await admin.rpc('email_confirm_weekly', {
    p_user: userId,
    p_text_version: textVersion,
    p_email_hash: emailHash,
    p_issued_at: issuedAt.toISOString(),
  })
  if (error) return { ok: false, reason: isEmailNotMigrated(error) ? 'not_migrated' : 'error' }
  return data === 'ok' || data === 'unchanged' || data === 'superseded'
    ? { ok: true, status: data }
    : { ok: false, reason: 'error' }
}

/** La dirección actual no es la confirmada: desactiva (y lo registra). Cliente admin. */
export async function requireWeeklyReconfirm(admin: Pick<SupabaseClient, 'rpc'>, userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc('email_reconfirm_required', { p_user: userId })
  if (error) throw new Error(`email_reconfirm_required: ${error.code ?? 'error'}`)
  return data === true
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
