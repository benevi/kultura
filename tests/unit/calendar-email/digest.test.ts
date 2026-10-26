// ============================================================
// F-28 — Envío del correo semanal: solo los lunes (y recuperación hasta el
// miércoles), una vez por persona y semana aunque el cron se repita, por
// lotes, con baja en 1 clic (RFC 8058) y sin datos personales en los logs.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  runWeeklyDigest,
  supabaseDigestStore,
  weeklyPeriodFromCampaign,
  markWeeklyReturn,
  STALE_SENDING_MS,
  needsSend,
  type DigestDeps,
  type DigestStore,
  type SendRow,
} from '@/lib/email/digest'
import { emailFingerprint, verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import type { EmailMessage, SendResult } from '@/lib/email/resend'
import type { CalendarEvent } from '@/lib/calendar/types'
import { fakeSupabase, opsOf } from '../plataformas-listas/fake-supabase'

const SECRET = 's'.repeat(40)
const CONFIG = { enabled: true as const, from: 'KULTURA <hola@kultura.test>', secret: SECRET, only: null }
const MONDAY = new Date('2026-12-14T06:00:00Z')
const TUESDAY = new Date('2026-12-15T06:00:00Z')
const THURSDAY = new Date('2026-12-17T06:00:00Z')
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const U3 = '33333333-3333-4333-8333-333333333333'

function memoryStore(
  opted: Array<{ user_id: string; consented_at: string | null; confirmed_email_hash?: string | null }>,
  emails: Record<string, string>,
  unconfirmed: string[] = []
) {
  const rows: SendRow[] = []
  let seq = 0
  const store: DigestStore & {
    rows: SendRow[]
    finished: Array<{ id: string; status: string; error?: string | null }>
    reconfirmed: string[]
  } = {
    rows,
    finished: [],
    reconfirmed: [],
    // Por defecto, cada uno confirmó la dirección que tiene ahora.
    listOptedIn: async () =>
      opted.map((p) => ({
        ...p,
        confirmed_email_hash:
          p.confirmed_email_hash !== undefined ? p.confirmed_email_hash : emails[p.user_id] ? emailFingerprint(emails[p.user_id]) : null,
      })),
    listSends: async (period) => rows.filter((r) => (r as SendRow & { period: string }).period === period).map((r) => ({ ...r })),
    claim: async (userId, period, existing) => {
      const found = rows.find((r) => r.user_id === userId && (r as SendRow & { period: string }).period === period)
      if (!existing) {
        if (found) return null
        const stamp = new Date().toISOString()
        const row = { id: `r${++seq}`, user_id: userId, status: 'sending', attempts: 1, updated_at: stamp, created_at: stamp, period } as SendRow & { period: string }
        rows.push(row)
        return row.id
      }
      if (!found || found.status !== existing.status || found.attempts !== existing.attempts) return null
      found.status = 'sending'
      found.attempts++
      return found.id
    },
    finish: async (id, patch) => {
      const row = rows.find((r) => r.id === id)!
      row.status = patch.status
      row.error = patch.error ?? null
      store.finished.push({ id, status: patch.status, error: patch.error })
    },
    profiles: async (ids) => new Map(ids.map((id) => [id, { username: `user-${id.slice(0, 2)}`, locale: id === U2 ? ('en' as const) : ('es' as const) }])),
    email: async (id) =>
      emails[id] && !unconfirmed.includes(id) ? { email: emails[id], email_confirmed_at: '2026-12-01T00:00:00Z' } : null,
    requireReconfirm: async (id) => {
      store.reconfirmed.push(id)
    },
  }
  return store
}

const WEEK_EVENT: CalendarEvent = {
  id: 'tv_1:episode:s1e2',
  mediaId: 'tv_1',
  type: 'tv',
  title: 'Serie',
  poster: null,
  status: 'in_progress',
  kind: 'episode',
  date: '2026-12-16',
  precision: 'day',
  season: 1,
  episode: 2,
}

function deps(store: DigestStore, over: Partial<DigestDeps> = {}) {
  const sent: EmailMessage[] = []
  const send = vi.fn(async (m: EmailMessage): Promise<SendResult> => {
    sent.push(m)
    return { ok: true, id: `re_${sent.length}` }
  })
  const calendar = vi.fn(async () => [
    WEEK_EVENT,
    // Fuera de la semana o sin día: no van en el correo.
    { ...WEEK_EVENT, id: 'b', date: '2026-12-28' },
    { ...WEEK_EVENT, id: 'c', date: null, precision: 'tba' as const },
    { ...WEEK_EVENT, id: 'd', date: '2026-12-10' },
  ])
  return { sent, send, calendar, d: { store, calendar, send, config: CONFIG, now: MONDAY, ...over } as DigestDeps }
}

describe('runWeeklyDigest', () => {
  let logs: string[]
  beforeEach(() => {
    logs = []
    for (const m of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
      })
    }
  })
  afterEach(() => vi.restoreAllMocks())

  it('desactivado: dice por qué y no toca nada', async () => {
    const store = memoryStore([], {})
    const listOptedIn = vi.spyOn(store, 'listOptedIn')
    const { d } = deps(store, { config: { enabled: false, reason: 'missing_from' } })
    expect(await runWeeklyDigest(d)).toEqual({ status: 'disabled', reason: 'missing_from' })
    expect(listOptedIn).not.toHaveBeenCalled()
  })

  it('jueves: no toca', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: '2026-12-01T00:00:00Z' }], { [U1]: 'a@x.es' })
    const { d, send } = deps(store, { now: THURSDAY })
    expect(await runWeeklyDigest(d)).toEqual({ status: 'not_scheduled', period: '2026-W51' })
    expect(send).not.toHaveBeenCalled()
  })

  it('sin la migración: not_migrated', async () => {
    const store = memoryStore([], {})
    store.listOptedIn = async () => null
    const { d } = deps(store)
    expect(await runWeeklyDigest(d)).toEqual({ status: 'not_migrated', period: '2026-W51' })
  })

  it('lunes: un correo por persona con lo de la semana, cabeceras de baja en 1 clic e idempotencia', async () => {
    const store = memoryStore(
      [
        { user_id: U1, consented_at: '2026-12-01T00:00:00Z' },
        { user_id: U2, consented_at: '2026-12-14T05:00:00Z' },
      ],
      { [U1]: 'ana@example.com', [U2]: 'bob@example.com' }
    )
    const { d, sent } = deps(store)
    const result = await runWeeklyDigest(d)
    expect(result).toEqual({ status: 'done', period: '2026-W51', eligible: 2, sent: 2, skipped: 0, failed: 0, remaining: 0 })
    expect(sent.map((m) => m.to)).toEqual(['ana@example.com', 'bob@example.com'])
    const [first, second] = sent
    expect(first.from).toBe(CONFIG.from)
    expect(first.subject).toBe('Esta semana en KULTURA: 1 novedad')
    expect(second.subject).toBe('This week on KULTURA: 1 update')
    expect(first.idempotencyKey).toBe(`weekly-2026-W51-${U1}`)
    expect(first.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    const unsub = /^<(https:\/\/[^>]+)>$/.exec(first.headers?.['List-Unsubscribe'] ?? '')?.[1]
    expect(unsub).toBeDefined()
    const url = new URL(unsub!)
    expect(url.pathname).toBe('/api/email/unsubscribe')
    expect(verifyUnsubscribeToken(url.searchParams.get('t'), SECRET, MONDAY)).toMatchObject({ ok: true, userId: U1 })
    // El enlace del cuerpo lleva a la página que pide confirmar (un GET nunca da de baja).
    expect(first.html).toContain('/es/email/unsubscribe?t=')
    expect(first.text).toContain('utm_campaign=weekly-2026-W51')
    expect(store.rows.map((r) => r.status)).toEqual(['sent', 'sent'])
  })

  it('si el cron se repite, nadie recibe dos (y dos a la vez tampoco)', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: '2026-12-01T00:00:00Z' }], { [U1]: 'ana@example.com' })
    const a = deps(store)
    const b = deps(store)
    await Promise.all([runWeeklyDigest(a.d), runWeeklyDigest(b.d)])
    expect(a.sent.length + b.sent.length).toBe(1)
    const again = deps(store)
    const result = await runWeeklyDigest(again.d)
    expect(again.sent).toHaveLength(0)
    expect(result).toMatchObject({ status: 'done', sent: 0, remaining: 0 })
  })

  it('semana vacía: sin correo y marcado para no reintentar', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: null }], { [U1]: 'ana@example.com' })
    const { d, send } = deps(store, { calendar: async () => [] })
    expect(await runWeeklyDigest(d)).toMatchObject({ sent: 0, skipped: 1 })
    expect(send).not.toHaveBeenCalled()
    expect(store.finished).toEqual([{ id: 'r1', status: 'skipped', error: 'empty' }])
  })

  it('un fallo de Resend se reintenta el martes (máx. 3 intentos), con el mismo Idempotency-Key', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: '2026-12-01T00:00:00Z' }], { [U1]: 'ana@example.com' })
    const monday = deps(store, { send: async () => ({ ok: false, reason: 'http_error', status: 500 }) })
    expect(await runWeeklyDigest(monday.d)).toMatchObject({ failed: 1 })
    expect(store.finished.at(-1)).toMatchObject({ status: 'failed', error: 'http_error_500' })
    const tuesday = deps(store, { now: TUESDAY })
    expect(await runWeeklyDigest(tuesday.d)).toMatchObject({ sent: 1 })
    expect(tuesday.sent[0].idempotencyKey).toBe(`weekly-2026-W51-${U1}`)
  })

  it('una fila "sending" de una ejecución cortada se recupera pasados 30 min', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: '2026-12-01T00:00:00Z' }], { [U1]: 'ana@example.com' })
    const stale = new Date(MONDAY.getTime() - STALE_SENDING_MS - 1000).toISOString()
    store.rows.push({ id: 'old', user_id: U1, status: 'sending', attempts: 1, updated_at: stale, created_at: stale, period: '2026-W51' } as SendRow)
    const { d, sent } = deps(store)
    await runWeeklyDigest(d)
    expect(sent).toHaveLength(1)
    const fresh = memoryStore([{ user_id: U1, consented_at: null }], { [U1]: 'a@x.es' })
    fresh.rows.push({ id: 'now', user_id: U1, status: 'sending', attempts: 1, updated_at: MONDAY.toISOString(), created_at: MONDAY.toISOString(), period: '2026-W51' } as SendRow)
    const other = deps(fresh)
    await runWeeklyDigest(other.d)
    expect(other.sent).toHaveLength(0)
  })

  it('dirección sin confirmar (email_confirmed_at vacío): no se envía', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: null }], { [U1]: 'ana@example.com' }, [U1])
    const { d, send } = deps(store)
    expect(await runWeeklyDigest(d)).toMatchObject({ sent: 0, skipped: 1 })
    expect(send).not.toHaveBeenCalled()
    expect(store.finished).toEqual([{ id: 'r1', status: 'skipped', error: 'no_recipient' }])
  })

  it('corte tras enviar: el martes (más de 23 h, fuera de la Idempotency-Key) NO se reenvía', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: '2026-12-01T00:00:00Z' }], { [U1]: 'ana@example.com' })
    // El lunes se reclamó y la función se cortó justo después de llamar a Resend.
    store.rows.push({ id: 'cut', user_id: U1, status: 'sending', attempts: 1, updated_at: MONDAY.toISOString(), created_at: MONDAY.toISOString(), period: '2026-W51' } as SendRow)
    const tuesday = deps(store, { now: TUESDAY })
    await runWeeklyDigest(tuesday.d)
    expect(tuesday.sent).toHaveLength(0)
  })

  it('fallo de red (¿salió o no?): se reintenta solo dentro de la ventana de la clave', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: '2026-12-01T00:00:00Z' }], { [U1]: 'ana@example.com' })
    const monday = deps(store, { send: async () => ({ ok: false, reason: 'network_error' }) })
    await runWeeklyDigest(monday.d)
    expect(store.finished.at(-1)).toMatchObject({ status: 'failed', error: 'network_error' })
    // El mismo lunes una hora después: sí (la clave de Resend evita el duplicado)…
    const row = store.rows[0]
    expect(needsSend(row, new Date(new Date(row.created_at).getTime() + 3600_000))).toBe(true)
    // …el martes, no.
    const tuesday = deps(store, { now: TUESDAY })
    await runWeeklyDigest(tuesday.d)
    expect(tuesday.sent).toHaveLength(0)
  })

  it('needsSend: reglas de reintento', () => {
    const base = { id: 'x', user_id: U1, attempts: 1, created_at: MONDAY.toISOString(), updated_at: MONDAY.toISOString() }
    const t = (h: number) => new Date(MONDAY.getTime() + h * 3600_000)
    expect(needsSend(undefined, t(0))).toBe(true)
    expect(needsSend({ ...base, status: 'sent' }, t(1))).toBe(false)
    expect(needsSend({ ...base, status: 'skipped' }, t(1))).toBe(false)
    expect(needsSend({ ...base, status: 'failed', error: 'http_error_503' }, t(48))).toBe(true)
    expect(needsSend({ ...base, status: 'failed', error: 'http_error_503', attempts: 3 }, t(48))).toBe(false)
    expect(needsSend({ ...base, status: 'failed', error: 'exception' }, t(22))).toBe(true)
    expect(needsSend({ ...base, status: 'failed', error: 'exception' }, t(24))).toBe(false)
    expect(needsSend({ ...base, status: 'sending' }, t(0.25))).toBe(false)
    expect(needsSend({ ...base, status: 'sending' }, t(1))).toBe(true)
    expect(needsSend({ ...base, status: 'sending' }, t(23.5))).toBe(false)
  })

  it('el martes solo recupera a quien ya estaba apuntado el lunes', async () => {
    const store = memoryStore(
      [
        { user_id: U1, consented_at: '2026-12-10T10:00:00Z' },
        { user_id: U2, consented_at: '2026-12-15T05:00:00Z' },
      ],
      { [U1]: 'a@x.es', [U2]: 'b@x.es' }
    )
    const { d, sent } = deps(store, { now: TUESDAY })
    expect(await runWeeklyDigest(d)).toMatchObject({ eligible: 1, sent: 1 })
    expect(sent.map((m) => m.to)).toEqual(['a@x.es'])
  })

  it('por lotes: el tope por ejecución deja el resto para el día siguiente', async () => {
    const opted = [U1, U2, U3].map((user_id) => ({ user_id, consented_at: '2026-12-01T00:00:00Z' }))
    const store = memoryStore(opted, { [U1]: 'a@x.es', [U2]: 'b@x.es', [U3]: 'c@x.es' })
    const first = deps(store, { cap: 2 })
    expect(await runWeeklyDigest(first.d)).toMatchObject({ sent: 2, remaining: 1 })
    const next = deps(store, { now: TUESDAY, cap: 2 })
    expect(await runWeeklyDigest(next.d)).toMatchObject({ sent: 1, remaining: 0 })
  })

  it('se corta por tiempo antes del límite de la función', async () => {
    const opted = [U1, U2, U3].map((user_id) => ({ user_id, consented_at: null }))
    const store = memoryStore(opted, { [U1]: 'a@x.es', [U2]: 'b@x.es', [U3]: 'c@x.es' })
    let t = 0
    const { d, sent } = deps(store, { clock: () => (t += 20_000), timeBudgetMs: 35_000 })
    expect(await runWeeklyDigest(d)).toMatchObject({ remaining: 2 })
    expect(sent).toHaveLength(1)
  })

  it('cambió de dirección desde que confirmó: no se envía, se desactiva y se pide confirmar la nueva', async () => {
    const store = memoryStore(
      [{ user_id: U1, consented_at: '2026-12-01T00:00:00Z', confirmed_email_hash: emailFingerprint('vieja@example.com') }],
      { [U1]: 'nueva@example.com' }
    )
    const requestOptin = vi.fn(async () => 'sent')
    const { d, send } = deps(store, { requestOptin })
    expect(await runWeeklyDigest(d)).toMatchObject({ sent: 0, skipped: 1 })
    expect(send).not.toHaveBeenCalled()
    expect(store.reconfirmed).toEqual([U1])
    expect(store.finished).toEqual([{ id: 'r1', status: 'skipped', error: 'email_changed' }])
    expect(requestOptin).toHaveBeenCalledWith({ userId: U1, email: 'nueva@example.com', username: 'user-11', locale: 'es' })
  })

  it('sin huella guardada (confirmación antigua): tampoco se envía', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: null, confirmed_email_hash: null }], { [U1]: 'ana@example.com' })
    const { d, send } = deps(store, { requestOptin: async () => 'sent' })
    await runWeeklyDigest(d)
    expect(send).not.toHaveBeenCalled()
    expect(store.reconfirmed).toEqual([U1])
  })

  it('la huella no distingue mayúsculas ni espacios', async () => {
    const store = memoryStore(
      [{ user_id: U1, consented_at: null, confirmed_email_hash: emailFingerprint(' Ana@Example.com') }],
      { [U1]: 'ana@example.com' }
    )
    const { d, sent } = deps(store)
    await runWeeklyDigest(d)
    expect(sent).toHaveLength(1)
  })

  it('WEEKLY_EMAIL_ONLY: los demás se saltan sin enviar', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: null }, { user_id: U2, consented_at: null }], { [U1]: 'yo@x.es', [U2]: 'otro@x.es' })
    const { d, sent } = deps(store, { config: { ...CONFIG, only: new Set(['yo@x.es']) } })
    expect(await runWeeklyDigest(d)).toMatchObject({ sent: 1, skipped: 1 })
    expect(sent.map((m) => m.to)).toEqual(['yo@x.es'])
  })

  it('en los logs no hay correos, ids ni tokens', async () => {
    const store = memoryStore([{ user_id: U1, consented_at: null }], { [U1]: 'ana@example.com' })
    const { d } = deps(store, { calendar: async () => { throw new Error(`boom ${U1} ana@example.com`) } })
    await runWeeklyDigest(d)
    const all = logs.join('\n')
    expect(all).not.toContain('ana@example.com')
    expect(all).not.toContain(U1)
    expect(all).not.toContain('v1.')
  })
})

describe('almacén real (consultas a Supabase)', () => {
  it('reclama con UNIQUE (upsert ignorando duplicados) y lee solo lo de la semana', async () => {
    const client = fakeSupabase({
      tables: {
        email_preferences: [{ data: [{ user_id: U1, consented_at: null, confirmed_email_hash: 'h' }], error: null }],
        email_sends: [{ data: [{ id: 'r1' }], error: null }],
      },
    })
    const store = supabaseDigestStore(client as never)
    expect(await store.listOptedIn()).toEqual([{ user_id: U1, consented_at: null, confirmed_email_hash: 'h' }])
    expect(opsOf(client, 'email_preferences', 'select')[0].args[0]).toContain('confirmed_email_hash')
    expect(opsOf(client, 'email_preferences', 'eq')).toContainEqual({ name: 'eq', args: ['weekly_digest', true] })
    expect(await store.claim(U1, '2026-W51', undefined)).toBe('r1')
    expect(opsOf(client, 'email_sends', 'upsert')[0].args).toEqual([
      { user_id: U1, kind: 'weekly', period: '2026-W51', status: 'sending' },
      { onConflict: 'user_id,kind,period', ignoreDuplicates: true },
    ])
  })

  it('sin la tabla → null (not_migrated)', async () => {
    const client = fakeSupabase({ tables: { email_preferences: [{ data: null, error: { code: 'PGRST205' } }] } })
    expect(await supabaseDigestStore(client as never).listOptedIn()).toBeNull()
  })
})

describe('vuelta desde el correo', () => {
  it('reconoce la campaña de la semana', () => {
    expect(weeklyPeriodFromCampaign('email', 'weekly-2026-W51')).toBe('2026-W51')
    expect(weeklyPeriodFromCampaign('twitter', 'weekly-2026-W51')).toBeNull()
    expect(weeklyPeriodFromCampaign('email', 'weekly-2026-W51; drop table')).toBeNull()
  })

  it('marca returned_at una sola vez (solo si estaba vacío) y nunca lanza', async () => {
    const client = fakeSupabase({ tables: { email_sends: [{ data: null, error: null }] } })
    await markWeeklyReturn(client as never, U1, '2026-W51')
    expect(opsOf(client, 'email_sends', 'is')).toContainEqual({ name: 'is', args: ['returned_at', null] })
    expect(opsOf(client, 'email_sends', 'eq')).toContainEqual({ name: 'eq', args: ['user_id', U1] })
    await expect(markWeeklyReturn({ from: () => { throw new Error('x') } } as never, U1, '2026-W51')).resolves.toBeUndefined()
  })
})
