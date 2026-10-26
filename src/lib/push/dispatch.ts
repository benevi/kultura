// ============================================================
// KULTURA — Envío de avisos push para un evento (F-33) · solo servidor
//
// Lo llama /api/push/dispatch cuando la base avisa (trigger push_on_event,
// pg_net, después del commit) con {kind, id}. Aquí se vuelve a leer la fila
// con el cliente admin, se decide a quién avisar, se manda a cada una de sus
// suscripciones y se limpia:
//   - 404/410 del servicio push o `expires_at` vencido → la suscripción se borra;
//   - éxito → failures = 0 y last_success_at;
//   - otro fallo → failures + 1, y a las MAX_FAILURES seguidas se borra (p. ej.
//     tras cambiar el par VAPID, las viejas ya no valen).
// Un evento de hace más de MAX_EVENT_AGE_MS no se envía (no se puede repetir
// un aviso viejo aunque alguien tuviera el secreto). En una amistad aceptada
// la fecha que cuenta es `accepted_at` (20261222340001): `created_at` es la de
// la solicitud, que puede tener semanas.
//
// Mensajes: un aviso por ráfaga. Si el mismo remitente ya escribió en esa
// conversación dentro del mismo tramo fijo de PUSH_MESSAGE_BURST_SECONDS, ese
// primer mensaje ya avisó y este no (`throttled`). Es la misma regla que aplica
// el trigger desde 20261222340001 (allí ni se llama a esta ruta); aquí queda
// por si la base aún tiene la función anterior. Mensajes de varias filas con
// la misma fecha: avisa el de id menor.
// ============================================================

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PushConfig } from './config'
import { buildPushPayload, type PushEvent } from './payload'
import { PUSH_LOCALES, type DispatchBody, type PushLocale } from './schemas'
import { sendPush, type PushOutcome, type PushMessage } from './webpush'

export const MAX_EVENT_AGE_MS = 10 * 60 * 1000
export const MAX_FAILURES = 10
/** Tope de envíos por evento (un grupo grande o muchas suscripciones escritas a mano). */
export const MAX_SUBSCRIPTIONS_PER_EVENT = 50
/** Tramo del aviso por ráfaga de mensajes (igual que en 20261222340001_push_throttle.sql). */
export const PUSH_MESSAGE_BURST_SECONDS = 30

const NOT_MIGRATED = new Set(['42P01', '42703', 'PGRST204', 'PGRST205'])

export interface DispatchDeps {
  admin: SupabaseClient
  config: PushConfig
  send?: (message: PushMessage, config: PushConfig) => Promise<PushOutcome>
  now?: () => number
}

export interface DispatchResult {
  status: 'done' | 'skipped'
  reason?: string
  sent: number
  removed: number
  failed: number
}

interface Target {
  recipients: string[]
  event: PushEvent
  ttl: number
  urgency: 'normal' | 'high'
  topic?: string
}

interface SubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  locale: string
  expires_at: string | null
  failures: number
}

const skipped = (reason: string): DispatchResult => ({ status: 'skipped', reason, sent: 0, removed: 0, failed: 0 })

function isFresh(createdAt: string | null | undefined, now: number): boolean {
  const at = Date.parse(createdAt ?? '')
  return Number.isFinite(at) && now - at <= MAX_EVENT_AGE_MS && at - now <= 60_000
}

/**
 * ¿Ya avisó otro mensaje del mismo remitente en esta conversación y tramo?
 * Se busca el PRIMERO del tramo (por fecha y, en empate, por id): si no es
 * este, este no avisa. Ante cualquier error de lectura, se avisa (mejor un
 * aviso de más que ninguno).
 */
async function isBurstFollowUp(
  admin: SupabaseClient,
  m: { id: string; conversation_id: string; sender_id: string; created_at: string | null },
): Promise<boolean> {
  const at = Date.parse(m.created_at ?? '')
  if (!m.created_at || !Number.isFinite(at)) return false
  const burstMs = PUSH_MESSAGE_BURST_SECONDS * 1000
  const { data, error } = await admin
    .from('messages')
    .select('id')
    .eq('conversation_id', m.conversation_id)
    .eq('sender_id', m.sender_id)
    .gte('created_at', new Date(Math.floor(at / burstMs) * burstMs).toISOString())
    .lte('created_at', m.created_at)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
  if (error) return false
  const first = ((data ?? []) as { id: string }[])[0]
  return !!first && first.id !== m.id
}

const FRIENDSHIP_COLUMNS = 'id, requester_id, receiver_id, status, created_at'

interface FriendshipRow {
  requester_id: string
  receiver_id: string
  status: string
  created_at: string | null
  /** `undefined` = la columna aún no existe (migración sin aplicar). */
  accepted_at?: string | null
}

/** La amistad con `accepted_at`, o sin ella si la migración no está aplicada. */
async function readFriendship(admin: SupabaseClient, id: string): Promise<FriendshipRow | null> {
  const withAcceptedAt = await admin
    .from('friendships')
    .select(`${FRIENDSHIP_COLUMNS}, accepted_at`)
    .eq('id', id)
    .maybeSingle()
  if (!withAcceptedAt.error) {
    const row = withAcceptedAt.data as FriendshipRow | null
    return row ? { ...row, accepted_at: row.accepted_at ?? null } : null
  }
  if (!NOT_MIGRATED.has(withAcceptedAt.error.code ?? '')) return null
  const { data } = await admin.from('friendships').select(FRIENDSHIP_COLUMNS).eq('id', id).maybeSingle()
  const row = data as FriendshipRow | null
  return row ? { ...row, accepted_at: undefined } : null
}

async function usernameOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from('users').select('username').eq('id', userId).maybeSingle()
  const name = (data as { username?: unknown } | null)?.username
  return typeof name === 'string' ? name : null
}

/** A quién y qué avisar; `string` = motivo para no enviar. */
async function resolveTarget(input: DispatchBody, admin: SupabaseClient, now: number): Promise<Target | string> {
  if (input.kind === 'message') {
    const { data: msg } = await admin
      .from('messages')
      .select('id, conversation_id, sender_id, created_at')
      .eq('id', input.id)
      .maybeSingle()
    const m = msg as { id: string; conversation_id: string; sender_id: string; created_at: string | null } | null
    if (!m) return 'not_found'
    if (!isFresh(m.created_at, now)) return 'stale'
    if (await isBurstFollowUp(admin, m)) return 'throttled'
    const { data: members } = await admin
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', m.conversation_id)
      .neq('user_id', m.sender_id)
    return {
      recipients: ((members ?? []) as { user_id: string }[]).map((r) => r.user_id),
      event: { kind: 'message', conversationId: m.conversation_id, senderUsername: await usernameOf(admin, m.sender_id) },
      ttl: 24 * 60 * 60,
      urgency: 'high',
      // Un aviso pendiente por conversación: el nuevo sustituye al anterior.
      topic: m.conversation_id.replace(/-/g, ''),
    }
  }

  if (input.kind === 'notification') {
    const { data } = await admin
      .from('notifications')
      .select('id, user_id, type, payload, created_at')
      .eq('id', input.id)
      .maybeSingle()
    const n = data as { id: string; user_id: string; type: string; payload: unknown; created_at: string | null } | null
    if (!n) return 'not_found'
    if (!isFresh(n.created_at, now)) return 'stale'
    const payload = n.payload && typeof n.payload === 'object' ? (n.payload as Record<string, unknown>) : {}
    return {
      recipients: [n.user_id],
      event: { kind: 'notification', notificationId: n.id, type: n.type, payload },
      ttl: 3 * 24 * 60 * 60,
      urgency: 'normal',
    }
  }

  const f = await readFriendship(admin, input.id)
  if (!f) return 'not_found'
  if (input.kind === 'friend_request') {
    if (f.status !== 'pending') return 'not_pending'
    if (!isFresh(f.created_at, now)) return 'stale'
    return {
      recipients: [f.receiver_id],
      event: { kind: 'friend_request', username: await usernameOf(admin, f.requester_id) },
      ttl: 3 * 24 * 60 * 60,
      urgency: 'normal',
    }
  }
  if (f.status !== 'accepted') return 'not_accepted'
  // Sin la columna (antes de 20261222340001) no hay fecha de aceptación: como
  // antes, se avisa. Con ella, null = aceptada antes de la migración.
  if (f.accepted_at !== undefined && !isFresh(f.accepted_at, now)) return 'stale'
  return {
    recipients: [f.requester_id],
    event: { kind: 'friend_accepted', username: await usernameOf(admin, f.receiver_id) },
    ttl: 3 * 24 * 60 * 60,
    urgency: 'normal',
  }
}

const asLocale = (value: string): PushLocale => ((PUSH_LOCALES as readonly string[]).includes(value) ? (value as PushLocale) : 'es')

export async function dispatchPush(input: DispatchBody, deps: DispatchDeps): Promise<DispatchResult> {
  const now = (deps.now ?? Date.now)()
  const send = deps.send ?? sendPush
  const { admin, config } = deps

  const target = await resolveTarget(input, admin, now)
  if (typeof target === 'string') return skipped(target)
  const recipients = Array.from(new Set(target.recipients))
  if (recipients.length === 0) return skipped('no_recipients')

  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, locale, expires_at, failures')
    .in('user_id', recipients)
    .order('updated_at', { ascending: false })
    .limit(MAX_SUBSCRIPTIONS_PER_EVENT)
  if (error) return skipped(NOT_MIGRATED.has(error.code ?? '') ? 'not_migrated' : 'read_failed')
  const subs = (data ?? []) as SubscriptionRow[]
  if (subs.length === 0) return skipped('no_subscriptions')

  const outcomes = await Promise.all(
    subs.map(async (sub): Promise<PushOutcome> => {
      const expires = sub.expires_at ? Date.parse(sub.expires_at) : NaN
      if (Number.isFinite(expires) && expires <= now) return { status: 'gone', httpStatus: 0 }
      return send(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
          payload: buildPushPayload(target.event, asLocale(sub.locale)),
          ttl: target.ttl,
          urgency: target.urgency,
          topic: target.topic,
        },
        config,
      )
    }),
  )

  const ok: string[] = []
  const remove: string[] = []
  const bump: { id: string; failures: number }[] = []
  outcomes.forEach((outcome, i) => {
    const sub = subs[i]
    if (outcome.status === 'sent') ok.push(sub.id)
    else if (outcome.status === 'gone' || (outcome.status === 'failed' && outcome.reason === 'endpoint_not_allowed')) remove.push(sub.id)
    else if (sub.failures + 1 >= MAX_FAILURES) remove.push(sub.id)
    else bump.push({ id: sub.id, failures: sub.failures + 1 })
  })

  const nowIso = new Date(now).toISOString()
  await Promise.all([
    remove.length ? admin.from('push_subscriptions').delete().in('id', remove) : null,
    ok.length ? admin.from('push_subscriptions').update({ failures: 0, last_success_at: nowIso }).in('id', ok) : null,
    ...bump.map((b) => admin.from('push_subscriptions').update({ failures: b.failures }).eq('id', b.id)),
  ])

  return { status: 'done', sent: ok.length, removed: remove.length, failed: outcomes.length - ok.length - remove.length }
}
