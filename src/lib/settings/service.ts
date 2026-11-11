// ============================================================
// KULTURA — Servicio de /api/settings (saneamiento 6.3)
//
// La base solo deja actualizar con el JWT del usuario bio, avatar_icon,
// avatar_color, preferred_locale y (desde F-12) library_visibility. El nombre
// de usuario se cambia con el cliente admin, después de validar formato,
// nombres reservados y que no esté cogido (ni como nombre antiguo de otra
// persona); por eso aquí se corta a mano la cuenta demo, que el admin no frena.
//
// F-12 (onboarding): `accept_terms` y `onboarding_done` los guarda el servidor
// en `account_state` (o en `app_metadata` si la migración aún no está).
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TablesUpdate } from '@/types/supabase'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import { demoForbidden } from '@/lib/account/service'
import { initialsFor, isReservedUsername } from '@/lib/account/identity'
import {
  hasAcceptedTerms,
  markOnboarded,
  readAccountState,
  recordTermsAcceptance,
} from '@/lib/account/account-state'
import { SETTINGS_ERRORS } from '@/lib/settings/errors'
import type { settingsPatchSchema } from '@/lib/api/contracts/settings'

type SettingsInput = z.output<typeof settingsPatchSchema>

const taken = () => failure<null>('conflict', { field: 'username', message: SETTINGS_ERRORS.usernameTaken })
const reserved = () => failure<null>('conflict', { field: 'username', message: SETTINGS_ERRORS.usernameReserved })
const writeFailed = () => failure<null>('internal', { message: 'Failed to update' })

export async function updateSettings(supabase: SupabaseClient, user: User, input: SettingsInput): Promise<ServiceResult<null>> {
  const demo = demoForbidden<null>(user)
  if (demo) return demo

  const { avatar_color, preferred_locale, avatar_icon, bio, library_visibility, accept_terms, onboarding_done } = input
  let { username } = input

  // El nombre que ya tiene no se revalida: un nombre antiguo que hoy estaría
  // reservado no puede impedir guardar el color o el idioma.
  if (username) {
    const { data: me } = await supabase.from('users').select('username').eq('id', user.id).maybeSingle()
    if ((me as { username?: string } | null)?.username === username) username = undefined
  }

  if (username) {
    if (isReservedUsername(username)) return reserved()
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle()
    if (existing) return taken()
  }

  const updates: TablesUpdate<'users'> = {}
  if (username !== undefined) updates.username = username
  if (avatar_color !== undefined) updates.avatar_color = avatar_color
  if (preferred_locale !== undefined) updates.preferred_locale = preferred_locale
  // `null` limpia el personaje: de ahí comparar con `undefined`.
  if (avatar_icon !== undefined) updates.avatar_icon = avatar_icon
  if (bio !== undefined) updates.bio = bio ? bio : null
  if (library_visibility !== undefined) updates.library_visibility = library_visibility

  // SEG-7: el onboarding no se da por terminado (ni "saltado") sin haber
  // aceptado los términos, en esta misma petición o antes.
  if (onboarding_done && !accept_terms) {
    const { state } = await readAccountState(supabase, user.id)
    if (!hasAcceptedTerms(state, user)) {
      return failure('conflict', { message: SETTINGS_ERRORS.termsRequired })
    }
  }

  const needsAdmin = updates.username !== undefined || accept_terms || onboarding_done
  const admin = needsAdmin ? createAdminClient() : null

  // Un nombre antiguo de OTRA persona queda reservado (Q8): quien lo cogiera
  // podría hacerse pasar por ella en enlaces viejos.
  if (admin && username) {
    const { data: previous, error: historyError } = await admin
      .from('username_history')
      .select('user_id')
      .eq('old_username', username)
      .maybeSingle()
    if (!historyError && previous && (previous as { user_id: string }).user_id !== user.id) return taken()
    updates.avatar_initials = initialsFor(username)
  }

  if (Object.keys(updates).length > 0) {
    // Con username, todo va en una sola escritura admin (atómica); sin él, con
    // el JWT del usuario, que sigue pasando por RLS y por demo_no_update.
    const writer = updates.username !== undefined && admin ? admin : supabase
    const { data, error } = await writer.from('users').update(updates).eq('id', user.id).select('id').single()
    // 23505: otro usuario se quedó el nombre entre la comprobación y la
    // escritura (o solo difiere en mayúsculas). 23514: CHECK de la base.
    if (error?.code === '23505') return taken()
    if (error?.code === '23514') return reserved()
    if (error || !data) return writeFailed()
  }

  if (admin && accept_terms && !(await recordTermsAcceptance(admin, user))) return writeFailed()
  if (admin && onboarding_done && !(await markOnboarded(admin, user))) return writeFailed()

  return success(null)
}
