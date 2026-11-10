// ============================================================
// KULTURA — Reautenticación antes de borrar la cuenta (saneamiento 1.1)
//
// Una sesión abierta no basta para borrar una cuenta: un portátil prestado o
// una pestaña olvidada no deben poder hacerlo. Con contraseña, se comprueba
// la contraseña; sin ella (solo Google), el inicio de sesión tiene que ser
// reciente.
// ============================================================

import 'server-only'
import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env.public'

/** Cuánto vale un inicio de sesión reciente para quien no tiene contraseña. */
export const REAUTH_MAX_AGE_MS = 10 * 60_000

export type ReauthCode = 'password_required' | 'wrong_password' | 'reauth_required'
export type ReauthResult = { ok: true } | { ok: false; code: ReauthCode }

type ReauthUser = Pick<User, 'id' | 'email' | 'app_metadata' | 'last_sign_in_at'>

/** ¿Entra con email y contraseña? (Las cuentas solo de Google, no.) */
export function hasPasswordIdentity(user: Pick<User, 'app_metadata'>): boolean {
  const meta = user.app_metadata ?? {}
  const providers = Array.isArray(meta.providers)
    ? (meta.providers as unknown[])
    : typeof meta.provider === 'string'
      ? [meta.provider]
      : []
  return providers.includes('email')
}

/** Comprueba la contraseña con un cliente aparte, sin tocar la sesión del usuario. */
async function passwordMatches(user: ReauthUser, password: string): Promise<boolean> {
  if (!user.email) return false
  const client = createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password })
  if (error || data.user?.id !== user.id) return false
  // La comprobación abre una sesión nueva: se cierra solo esa.
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
  return true
}

export async function verifyDeletionIdentity(
  user: ReauthUser,
  password: string | null,
  now: number = Date.now(),
): Promise<ReauthResult> {
  if (hasPasswordIdentity(user)) {
    if (!password) return { ok: false, code: 'password_required' }
    return (await passwordMatches(user, password)) ? { ok: true } : { ok: false, code: 'wrong_password' }
  }
  const lastSignIn = Date.parse(user.last_sign_in_at ?? '')
  if (Number.isFinite(lastSignIn) && now - lastSignIn <= REAUTH_MAX_AGE_MS) return { ok: true }
  return { ok: false, code: 'reauth_required' }
}
