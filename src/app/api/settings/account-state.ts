// ============================================================
// KULTURA — Estado de la cuenta (F-12, solo servidor)
//
// `account_state` (migración 20261101120001_identity_privacy.sql) guarda lo
// que solo debe ver el dueño: aceptación de términos, onboarding y borrado
// pendiente. Todo aquí funciona ANTES de aplicar la migración:
//   - sin la tabla, términos y onboarding se guardan en `app_metadata` (solo
//     lo escribe el service role) y "es nuevo" se deduce de la fecha de alta;
//   - sin las funciones de traspaso, borrar la cuenta hace lo de siempre.
// ============================================================

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isDemoUser } from '@/lib/demo'
import { TERMS_VERSION } from './identity'

/** Códigos de "esto aún no existe" (tabla, columna o función sin migrar). */
const NOT_MIGRATED = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

export function isNotMigrated(error: { code?: string | null } | null | undefined): boolean {
  return !!error && NOT_MIGRATED.has(error.code ?? '')
}

/** Banderas que Víctor activa en Vercel tras aplicar la migración. */
export function libraryVisibilityEnabled(): boolean {
  return process.env.LIBRARY_VISIBILITY === '1'
}
export function accountGraceEnabled(): boolean {
  return process.env.ACCOUNT_GRACE === '1'
}

export interface AccountState {
  terms_accepted_at: string | null
  terms_version: string | null
  onboarded_at: string | null
  deletion_requested_at: string | null
}

/** Una cuenta creada hace menos de esto se considera recién llegada (sin tabla). */
const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000

/**
 * Fila de `account_state` del usuario. `migrated: false` si la tabla no existe
 * todavía; `state: null` si existe pero no hay fila.
 */
export async function readAccountState(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ migrated: boolean; state: AccountState | null }> {
  const { data, error } = await supabase
    .from('account_state')
    .select('terms_accepted_at, terms_version, onboarded_at, deletion_requested_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { migrated: !isNotMigrated(error), state: null }
  return { migrated: true, state: (data as AccountState | null) ?? null }
}

type MaybeUser = Pick<User, 'id' | 'created_at' | 'app_metadata' | 'user_metadata'>

/** ¿Tiene que pasar por `/welcome`? Nunca la demo; las cuentas antiguas, tampoco. */
export async function needsOnboarding(supabase: SupabaseClient, user: MaybeUser): Promise<boolean> {
  if (isDemoUser(user)) return false
  const { state } = await readAccountState(supabase, user.id)
  if (state) return state.onboarded_at === null
  if (user.app_metadata?.onboarded_at) return false
  const created = Date.parse(user.created_at ?? '')
  return Number.isFinite(created) && Date.now() - created < NEW_ACCOUNT_WINDOW_MS
}

/** ¿Aceptó ya los términos? (registro por email o paso 1 de `/welcome`). */
export function hasAcceptedTerms(state: AccountState | null, user: MaybeUser): boolean {
  return Boolean(
    state?.terms_accepted_at ||
      user.app_metadata?.terms_accepted_at ||
      user.user_metadata?.terms_accepted === true,
  )
}

/**
 * Escribe en `account_state` con el cliente admin; sin la tabla, en
 * `app_metadata` (que el usuario no puede tocar). Devuelve false si no se
 * pudo guardar en ningún sitio.
 */
async function writeAccountState(
  admin: SupabaseClient,
  user: MaybeUser,
  fields: Partial<AccountState>,
): Promise<boolean> {
  const { error } = await admin
    .from('account_state')
    .upsert({ user_id: user.id, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (!error) return true
  if (!isNotMigrated(error)) return false
  const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), ...fields },
  })
  return !metaError
}

export function recordTermsAcceptance(admin: SupabaseClient, user: MaybeUser): Promise<boolean> {
  return writeAccountState(admin, user, {
    terms_accepted_at: new Date().toISOString(),
    terms_version: TERMS_VERSION,
  })
}

export function markOnboarded(admin: SupabaseClient, user: MaybeUser): Promise<boolean> {
  return writeAccountState(admin, user, { onboarded_at: new Date().toISOString() })
}

/** Programa el borrado (ROJO-7). Solo con la tabla: sin ella no hay cron que lo cumpla. */
export async function scheduleDeletion(admin: SupabaseClient, userId: string): Promise<string | null> {
  const requestedAt = new Date().toISOString()
  const { error } = await admin
    .from('account_state')
    .upsert({ user_id: userId, deletion_requested_at: requestedAt, updated_at: requestedAt }, { onConflict: 'user_id' })
  return error ? null : requestedAt
}

export async function cancelDeletion(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { error } = await admin
    .from('account_state')
    .update({ deletion_requested_at: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  return !error
}

export interface DeletionPreview {
  groups: Array<{ name: string; successor: string | null }>
  lists: Array<{ name: string; successor: string | null }>
}

/** Grupos y listas que cambian de dueño (o se pierden) al borrar la cuenta. */
export async function readDeletionPreview(admin: SupabaseClient, userId: string): Promise<DeletionPreview | null> {
  const { data, error } = await admin.rpc('deletion_preview', { p_user: userId })
  if (error || !data) return null
  const raw = data as Partial<DeletionPreview>
  return { groups: raw.groups ?? [], lists: raw.lists ?? [] }
}

/**
 * Borra la cuenta: primero traspasa grupos y listas colaborativas (si la
 * función existe) y después el usuario de Auth, que arrastra el resto en
 * cascada. Un fallo del traspaso que NO sea "sin migrar" para el borrado:
 * mejor no borrar que destruir lo de otros.
 */
export async function deleteAccountNow(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true; transferred: { groups: number; lists: number } | null } | { ok: false; step: 'transfer' | 'delete'; message: string }> {
  const { data, error } = await admin.rpc('transfer_owned_content', { p_user: userId })
  if (error && !isNotMigrated(error)) {
    return { ok: false, step: 'transfer', message: error.message }
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) return { ok: false, step: 'delete', message: deleteError.message }
  return { ok: true, transferred: error ? null : ((data as { groups: number; lists: number } | null) ?? null) }
}
