// ============================================================
// KULTURA — Enlace de invitación (CRE-7). SOLO SERVIDOR.
//
// `siteUrl()/{locale}/u/{username}?ref={username}&inv={firma}`.
//
// Por qué una firma: con la biblioteca "solo amigos" por defecto (D-04), una
// amistad automática a partir de un `?ref=` cualquiera dejaría a cualquiera
// registrarse con `?ref=<víctima>` y leer su biblioteca. Solo el enlace que
// genera KULTURA para su dueño (Amigos, su colección) lleva una firma válida;
// un `ref` sin firma sirve para atribuir el alta, nunca para hacerse amigo.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/site-url'
import { createLogger } from '@/lib/logger'
import { track } from './track'

const log = createLogger('invite')

const SIG_LENGTH = 20

/** Clave de la firma: `INVITE_SECRET` o, si no está, la del service role. */
function inviteSecret(): string | null {
  return process.env.INVITE_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
}

/** Firma de la invitación de `userId` (estable: cambiar de nombre no la rompe). */
export function inviteSignature(userId: string): string | null {
  const secret = inviteSecret()
  if (!secret || !userId) return null
  return createHmac('sha256', secret).update(`kultura-invite:v1:${userId}`).digest('hex').slice(0, SIG_LENGTH)
}

export function isValidInviteSignature(userId: string, sig: string | null | undefined): boolean {
  const expected = inviteSignature(userId)
  if (!expected || !sig || sig.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig.toLowerCase()))
}

/** Ruta de la invitación (sin origen), p. ej. para el botón de compartir. */
export function invitePath(locale: string, user: { id: string; username: string }): string {
  const params = new URLSearchParams({ ref: user.username })
  const sig = inviteSignature(user.id)
  if (sig) params.set('inv', sig)
  return `/${locale}/u/${encodeURIComponent(user.username)}?${params.toString()}`
}

/** URL completa de la invitación (Amigos). */
export function inviteUrl(locale: string, user: { id: string; username: string }): string {
  return `${siteUrl()}${invitePath(locale, user)}`
}

/** Notificar a quien invita: solo cuando la lista de avisos sepa pintarlo. */
function inviteNotifyEnabled(): boolean {
  return process.env.INVITE_NOTIFY === '1'
}

type Admin = ReturnType<typeof createAdminClient>

async function findInviter(admin: Admin, ref: string): Promise<{ id: string; username: string } | null> {
  const { data } = await admin.from('users').select('id, username').eq('username', ref).maybeSingle()
  if (data) return data as { id: string; username: string }
  // Nombre antiguo (F-12): el enlace se compartió antes de cambiarlo.
  const { data: current, error } = await admin.rpc('username_redirect', { p_username: ref })
  if (error || typeof current !== 'string' || !current || current === ref) return null
  const { data: renamed } = await admin.from('users').select('id, username').eq('username', current).maybeSingle()
  return (renamed as { id: string; username: string } | null) ?? null
}

export type InviteOutcome = 'accepted' | 'already_friends' | 'invalid' | 'self' | 'error'

/**
 * Acepta la invitación al registrarse: amistad aceptada entre quien invita y
 * la cuenta nueva, evento `invite_accepted` y (con `INVITE_NOTIFY=1`) aviso a
 * quien invitó. Con el cliente admin porque la fila es "de los dos" y la cuenta
 * nueva no puede escribir avisos de otro. Nunca lanza.
 */
export async function acceptInvite(
  newUser: { id: string; app_metadata?: Record<string, unknown> | null },
  ref: string,
  sig: string | undefined,
): Promise<InviteOutcome> {
  try {
    const admin = createAdminClient()
    const inviter = await findInviter(admin, ref)
    if (!inviter || !isValidInviteSignature(inviter.id, sig)) return 'invalid'
    if (inviter.id === newUser.id) return 'self'

    const { data: existing } = await admin
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${inviter.id},receiver_id.eq.${newUser.id}),and(requester_id.eq.${newUser.id},receiver_id.eq.${inviter.id})`,
      )
      .limit(1)
    if (Array.isArray(existing) && existing.length > 0) return 'already_friends'

    const { error } = await admin
      .from('friendships')
      .insert({ requester_id: inviter.id, receiver_id: newUser.id, status: 'accepted' })
    if (error) {
      log.warn('no se pudo crear la amistad de la invitación', { code: error.code, message: error.message })
      return 'error'
    }

    const { data: me } = await admin.from('users').select('username').eq('id', newUser.id).maybeSingle()
    await Promise.all([
      track(newUser, 'invite_accepted', { inviter_id: inviter.id }, { dedupeKey: `invite_accepted:${newUser.id}` }),
      inviteNotifyEnabled()
        ? admin.from('notifications').insert({
            user_id: inviter.id,
            type: 'invite_accepted',
            payload: { userId: newUser.id, fromUsername: (me as { username?: string } | null)?.username ?? null },
          })
        : null,
    ])
    return 'accepted'
  } catch (e) {
    log.warn('invitación sin aplicar', { message: e instanceof Error ? e.message : String(e) })
    return 'error'
  }
}
