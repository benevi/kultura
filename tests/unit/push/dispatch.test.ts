// @vitest-environment node
/**
 * F-33 · Qué se avisa, a quién y en qué idioma; limpieza de suscripciones.
 */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { dispatchPush, MAX_FAILURES } from '@/lib/push/dispatch'
import { buildPushPayload, cleanName } from '@/lib/push/payload'
import type { PushConfig } from '@/lib/push/config'
import type { PushMessage, PushOutcome } from '@/lib/push/webpush'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import { fakeDb } from './fake-db'

const NOW = Date.UTC(2026, 11, 22, 12)
const recent = new Date(NOW - 5_000).toISOString()
const CONV = '6f1c2d3e-4b5a-4c6d-8e7f-001122334455'
const MSG = '7a1c2d3e-4b5a-4c6d-8e7f-001122334455'
const NOTIF = '8b1c2d3e-4b5a-4c6d-8e7f-001122334455'
const FRIEND = '9c1c2d3e-4b5a-4c6d-8e7f-001122334455'
const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'
const C = 'cccccccc-0000-4000-8000-000000000003'
const config = { publicKey: 'k' } as unknown as PushConfig

const sub = (id: string, user: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: user,
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  p256dh: 'B'.padEnd(87, 'A'),
  auth: 'x'.repeat(22),
  locale: 'es',
  expires_at: null,
  failures: 0,
  updated_at: recent,
  ...extra,
})

function world() {
  return fakeDb({
    users: [
      { id: A, username: 'ana' },
      { id: B, username: 'bea' },
      { id: C, username: 'carla' },
    ],
    messages: [{ id: MSG, conversation_id: CONV, sender_id: A, content: 'secreto', created_at: recent }],
    conversation_members: [
      { conversation_id: CONV, user_id: A },
      { conversation_id: CONV, user_id: B },
      { conversation_id: CONV, user_id: C },
    ],
    notifications: [
      {
        id: NOTIF,
        user_id: B,
        type: 'recommendation',
        payload: { fromUsername: 'ana', mediaTitle: 'Dune', message: 'nota privada' },
        created_at: recent,
      },
    ],
    friendships: [{ id: FRIEND, requester_id: A, receiver_id: B, status: 'pending', created_at: recent }],
    push_subscriptions: [sub('s-a', A), sub('s-b1', B), sub('s-b2', B, { locale: 'en' }), sub('s-c', C)],
  })
}

function sender(outcome: (m: PushMessage) => PushOutcome = () => ({ status: 'sent', httpStatus: 201 })) {
  const sent: PushMessage[] = []
  const send = vi.fn(async (m: PushMessage) => {
    sent.push(m)
    return outcome(m)
  })
  return { send, sent }
}

const run = (db: ReturnType<typeof fakeDb>, input: Parameters<typeof dispatchPush>[0], send: ReturnType<typeof sender>['send']) =>
  dispatchPush(input, { admin: db as unknown as SupabaseClient, config, send, now: () => NOW })

describe('push · dispatchPush', () => {
  it('mensaje: avisa a los demás miembros (no al que escribe), en su idioma y sin el texto', async () => {
    const db = world()
    const { send, sent } = sender()
    const r = await run(db, { kind: 'message', id: MSG }, send)
    expect(r).toEqual({ status: 'done', sent: 3, removed: 0, failed: 0 })
    expect(sent.map((m) => m.endpoint.split('/').pop()).sort()).toEqual(['s-b1', 's-b2', 's-c'])
    const es1 = sent.find((m) => m.endpoint.endsWith('s-b1'))!
    const en1 = sent.find((m) => m.endpoint.endsWith('s-b2'))!
    expect(es1.payload).toEqual({
      v: 1,
      lang: 'es',
      title: 'Nuevo mensaje',
      body: '@ana te ha escrito.',
      url: `/es/chat/${CONV}`,
      tag: `chat-${CONV}`,
    })
    expect(en1.payload).toMatchObject({ lang: 'en', body: '@ana sent you a message.', url: `/en/chat/${CONV}` })
    expect(JSON.stringify(sent)).not.toContain('secreto')
    expect(es1).toMatchObject({ urgency: 'high', topic: CONV.replace(/-/g, '') })
    // Éxito: contador a cero y fecha del último envío.
    expect(db.tables.push_subscriptions.find((s) => s.id === 's-c')).toMatchObject({ failures: 0, last_success_at: new Date(NOW).toISOString() })
  })

  it('notificación: solo a su destinatario y sin la nota privada de la recomendación', async () => {
    const db = world()
    const { send, sent } = sender()
    const r = await run(db, { kind: 'notification', id: NOTIF }, send)
    expect(r.sent).toBe(2)
    expect(sent.every((m) => m.endpoint.includes('s-b'))).toBe(true)
    expect(sent[0].payload).toMatchObject({ body: '@ana te recomienda «Dune».', url: '/es/notifications' })
    expect(JSON.stringify(sent)).not.toContain('nota privada')
  })

  it('amistad: solicitud al que la recibe; aceptada, al que la pidió', async () => {
    const db = world()
    const a = sender()
    await run(db, { kind: 'friend_request', id: FRIEND }, a.send)
    expect(a.sent.map((m) => m.endpoint.split('/').pop()).sort()).toEqual(['s-b1', 's-b2'])
    expect(a.sent[0].payload).toMatchObject({ url: '/es/friends' })
    expect(await run(db, { kind: 'friend_accepted', id: FRIEND }, a.send)).toMatchObject({ status: 'skipped', reason: 'not_accepted' })
    db.tables.friendships[0].status = 'accepted'
    const b = sender()
    await run(db, { kind: 'friend_accepted', id: FRIEND }, b.send)
    expect(b.sent.map((m) => m.endpoint.split('/').pop())).toEqual(['s-a'])
    expect(b.sent[0].payload).toMatchObject({ body: '@bea ha aceptado tu solicitud de amistad.' })
    expect(await run(db, { kind: 'friend_request', id: FRIEND }, b.send)).toMatchObject({ reason: 'not_pending' })
  })

  it('no reenvía eventos viejos ni inexistentes', async () => {
    const db = world()
    db.tables.messages[0].created_at = new Date(NOW - 11 * 60_000).toISOString()
    const { send } = sender()
    expect(await run(db, { kind: 'message', id: MSG }, send)).toMatchObject({ status: 'skipped', reason: 'stale' })
    expect(await run(db, { kind: 'notification', id: CONV }, send)).toMatchObject({ status: 'skipped', reason: 'not_found' })
    expect(send).not.toHaveBeenCalled()
  })

  it('404/410 y caducadas se borran; otros fallos suman y a las MAX_FAILURES seguidas se borran', async () => {
    const db = world()
    db.tables.push_subscriptions.find((s) => s.id === 's-b2')!.expires_at = new Date(NOW - 1000).toISOString()
    db.tables.push_subscriptions.find((s) => s.id === 's-c')!.failures = MAX_FAILURES - 1
    db.tables.push_subscriptions.push(sub('s-c2', C))
    const { send, sent } = sender((m) =>
      m.endpoint.endsWith('s-b1')
        ? { status: 'gone', httpStatus: 410 }
        : { status: 'failed', httpStatus: 503, reason: 'http_503' },
    )
    const r = await run(db, { kind: 'message', id: MSG }, send)
    // s-b2 caducada: ni se intenta.
    expect(sent.map((m) => m.endpoint.split('/').pop()).sort()).toEqual(['s-b1', 's-c', 's-c2'])
    expect(r).toEqual({ status: 'done', sent: 0, removed: 3, failed: 1 })
    expect(db.tables.push_subscriptions.map((s) => s.id).sort()).toEqual(['s-a', 's-c2'])
    expect(db.tables.push_subscriptions.find((s) => s.id === 's-c2')!.failures).toBe(1)
  })

  it('sin migración o sin suscripciones: no hace nada y no falla', async () => {
    const db = world()
    db.errors.push_subscriptions = { code: 'PGRST205', message: 'no table' }
    const { send } = sender()
    expect(await run(db, { kind: 'message', id: MSG }, send)).toMatchObject({ status: 'skipped', reason: 'not_migrated' })
    const empty = world()
    empty.tables.push_subscriptions = []
    expect(await run(empty, { kind: 'message', id: MSG }, send)).toMatchObject({ reason: 'no_subscriptions' })
    expect(send).not.toHaveBeenCalled()
  })
})

describe('push · textos', () => {
  it('paridad es/en del namespace push y push va al final del archivo, tras collection', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]))
    expect(keys(en.push).sort()).toEqual(keys(es.push).sort())
    for (const m of [es, en]) expect(Object.keys(m).slice(-2)).toEqual(['collection', 'push'])
  })

  it('el bloque push cumple VOZ.md (lo excluyen los tests de F-31): tú, una sola fórmula de error, sin emojis ni "..."', () => {
    const flat = (o: object, p = ''): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]))
    const esV = flat(es.push)
    const enV = flat(en.push)
    const bad = [
      ...esV.filter(([, v]) => /\busted(es)?\b|^Error\b|\bError al\b|\bNo se (ha |han )?pud|\bInt[ée]ntalo\b|\bVuelve a intentarlo\b/i.test(v)),
      ...enV.filter(([, v]) => /^(Failed|Error)\b|\bPlease try again\b|^Could not\b|^Couldn['’]t\b/i.test(v)),
      ...[...esV, ...enV].filter(([, v]) => v.includes('...') || /\p{Extended_Pictographic}/u.test(v)),
    ]
    expect(bad).toEqual([])
    expect(es.push.settings.error).toMatch(/^No hemos podido .+ reintenta\.$/)
    expect(en.push.settings.error).toMatch(/^We couldn't .+ try again\.$/)
  })

  it('cada tipo de notificación tiene su frase y hay un texto genérico para lo desconocido', () => {
    const p = (type: string, payload: Record<string, unknown>) =>
      buildPushPayload({ kind: 'notification', notificationId: NOTIF, type, payload }, 'es').body
    expect(p('list_invite', { fromUsername: 'ana', listName: 'Pelis' })).toBe('@ana te ha invitado a la lista «Pelis».')
    expect(p('group_invite', { fromUsername: 'ana', groupName: 'Club' })).toBe('@ana te ha invitado al grupo «Club».')
    expect(p('group_invite', { fromUsername: 'ana' })).toBe('@ana te ha invitado a un grupo.')
    expect(p('recommendation', { fromUsername: 'ana' })).toBe('@ana te ha recomendado algo.')
    expect(p('otra_cosa', { fromUsername: 'ana' })).toBe('Tienes novedades en KULTURA.')
    expect(p('recommendation', {})).toBe('Tienes novedades en KULTURA.')
  })

  it('nombres en una línea y recortados; una conversación rara no entra en la URL', () => {
    expect(cleanName('a\nb c\u0007d')).toBe('a b c d')
    expect(Array.from(cleanName('x'.repeat(200))).length).toBe(60)
    const r = buildPushPayload({ kind: 'message', conversationId: '../../evil', senderUsername: null }, 'en')
    expect(r).toMatchObject({ url: '/en/chat', body: 'You have a new message.' })
  })
})
