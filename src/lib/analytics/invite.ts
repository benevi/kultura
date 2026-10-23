// ============================================================
// KULTURA — Enlace de invitación (CRE-7). SOLO SERVIDOR.
//
// `siteUrl()/{locale}/u/{username}?ref={username}&inv={exp}.{firma}`.
//
// Por qué una firma: con la biblioteca "solo amigos" por defecto (D-04), una
// amistad automática a partir de un `?ref=` cualquiera dejaría a cualquiera
// registrarse con `?ref=<víctima>` y leer su biblioteca. Solo el enlace que
// genera KULTURA para su dueño (Amigos, su colección) lleva una firma válida;
// un `ref` sin firma sirve para atribuir el alta, nunca para hacerse amigo.
//
// La firma CADUCA (30 días, `exp` en segundos Unix): un enlace que circula
// por ahí deja de crear amistades solo. Se firma `usuario|ref|exp`.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/site-url'
import { createLogger } from '@/lib/logger'
import { track } from './track'

const log = createLogger('invite')

/** Vida de un enlace de invitación. */
export const INVITE_TTL_DAYS = 30
const INVITE_TTL_S = INVITE_TTL_DAYS * 24 * 60 * 60
/** 128 bits de HMAC en hexadecimal. */
const MAC_HEX = 32
const INV_RE = /^(\d{9,11})\.([0-9a-f]{32})$/

/** Clave de la firma: `INVITE_SECRET` o, si no está, la del service role. */
function inviteSecret(): string | null {
  return process.env.INVITE_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
}

function mac(secret: string, userId: string, ref: string, exp: number): string {
  return createHmac('sha256', secret)
    .update(`kultura-invite:v2|${userId}|${ref.toLowerCase()}|${exp}`)
    .digest('hex')
    .slice(0, MAC_HEX)
}

/**
 * Firma `<exp>.<hmac>` de la invitación de `userId` con el nombre `ref`,
 * válida `INVITE_TTL_DAYS` días desde `nowMs`.
 */
export function inviteSignature(userId: string, ref: string, nowMs = Date.now()): string | null {
  const secret = inviteSecret()
  if (!secret || !userId || !ref) return null
  const exp = Math.floor(nowMs / 1000) + INVITE_TTL_S
  return `${exp}.${mac(secret, userId, ref, exp)}`
}

/**
 * ¿Es `inv` una firma vigente de `userId` para `ref`? Rechaza formato
 * inválido, caducada o con una caducidad más lejana de lo que se emite.
 * Compara bytes de igual longitud con `timingSafeEqual`.
 */
export function isValidInviteSignature(
  userId: string,
  ref: string | null | undefined,
  inv: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  const secret = inviteSecret()
  if (!secret || !userId || !ref || !inv) return false
  const match = INV_RE.exec(inv.toLowerCase())
  if (!match) return false
  const exp = Number(match[1])
  const now = Math.floor(nowMs / 1000)
  if (!Number.isSafeInteger(exp) || exp <= now || exp > now + INVITE_TTL_S + 60) return false
  const expected = Buffer.from(mac(secret, userId, ref, exp), 'utf8')
  const given = Buffer.from(match[2], 'utf8')
  if (expected.byteLength !== given.byteLength) return false
  return timingSafeEqual(expected, given)
}

/** Ruta de la invitación (sin origen), p. ej. para el botón de compartir. */
export function invitePath(locale: string, user: { id: string; username: string }, nowMs = Date.now()): string {
  const params = new URLSearchParams({ ref: user.username })
  const sig = inviteSignature(user.id, user.username, nowMs)
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

/** "La tabla aún no existe" (F-11 sin aplicar): no hay bloqueos posibles. */
const NOT_MIGRATED = new Set(['42P01', 'PGRST205'])

/**
 * ¿Hay un bloqueo entre los dos, en cualquier sentido? El cliente admin se
 * salta la RLS de F-11, así que se comprueba aquí. Ante cualquier error que no
 * sea "la tabla no existe", se trata como bloqueado (no se crea nada).
 */
async function isBlockedEitherWay(admin: Admin, a: string, b: string): Promise<boolean> {
  const { data, error } = await admin
    .from('blocks')
    .select('blocker_id')
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1)
  if (error) return !NOT_MIGRATED.has(error.code ?? '')
  return Array.isArray(data) && data.length > 0
}

/**
 * `blocked` es solo para el servidor: a quien se registra no se le dice nada
 * distinto de cualquier otro enlace que no crea amistad.
 */
export type InviteOutcome = 'accepted' | 'already_friends' | 'blocked' | 'invalid' | 'self' | 'error'

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
    if (!inviter || !isValidInviteSignature(inviter.id, ref, sig)) return 'invalid'
    if (inviter.id === newUser.id) return 'self'

    // F-11: un bloqueo en cualquier sentido impide la amistad (y no se revela).
    if (await isBlockedEitherWay(admin, inviter.id, newUser.id)) return 'blocked'

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
