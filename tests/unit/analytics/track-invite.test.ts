// D-12 / CRE-7: eventos de servidor (nunca lanzan) e invitación firmada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  ops: [] as Array<{ table: string; op: string; row?: unknown; opts?: unknown; filter?: unknown }>,
  results: {} as Record<string, Array<{ data?: unknown; error?: unknown }>>,
  rpc: vi.fn(),
  throwOnCreate: false,
  hang: false,
}))

function builder(table: string) {
  const next = () => h.results[table]?.shift() ?? { data: null, error: null }
  const resolveLater = () =>
    h.hang ? new Promise(() => undefined) : Promise.resolve(next())
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'or', 'limit']) b[m] = (...args: unknown[]) => {
    if (m === 'or') h.ops.push({ table, op: 'or', filter: args[0] })
    return b
  }
  b.maybeSingle = () => resolveLater()
  b.then = (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) => resolveLater().then(resolve, reject)
  b.insert = (row: unknown) => {
    h.ops.push({ table, op: 'insert', row })
    return { then: (r: (x: unknown) => unknown, j: (e: unknown) => unknown) => resolveLater().then(r, j) }
  }
  b.upsert = (row: unknown, opts: unknown) => {
    h.ops.push({ table, op: 'upsert', row, opts })
    return { then: (r: (x: unknown) => unknown, j: (e: unknown) => unknown) => resolveLater().then(r, j) }
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (h.throwOnCreate) throw new Error('missing env')
    return { from: (t: string) => builder(t), rpc: h.rpc }
  },
}))

import { track, cleanProps } from '@/lib/analytics/track'
import { acceptInvite, inviteSignature, invitePath, isValidInviteSignature } from '@/lib/analytics/invite'

beforeEach(() => {
  h.ops.length = 0
  h.results = {}
  h.rpc.mockReset()
  h.throwOnCreate = false
  h.hang = false
  process.env.INVITE_SECRET = 'secreto-de-prueba'
})
afterEach(() => {
  delete process.env.INVITE_SECRET
  delete process.env.INVITE_NOTIFY
  delete process.env.ANALYTICS_DISABLED
  vi.useRealTimers()
})

describe('track()', () => {
  it('inserta el evento del usuario registrado con props limpias', async () => {
    expect(await track({ id: 'u1' }, 'library_add', { media_type: 'movie', 'Bad Key': 1, n: Infinity, ok: true })).toBe(true)
    expect(h.ops).toEqual([
      { table: 'analytics_events', op: 'insert', row: { user_id: 'u1', name: 'library_add', props: { media_type: 'movie', ok: true }, dedupe_key: null } },
    ])
  })

  it('con dedupeKey usa ON CONFLICT DO NOTHING sobre dedupe_key', async () => {
    await track({ id: 'u1' }, 'signup_completed', {}, { dedupeKey: 'signup_completed:u1' })
    expect(h.ops[0]).toMatchObject({ op: 'upsert', opts: { onConflict: 'dedupe_key', ignoreDuplicates: true } })
  })

  it('la demo, sin usuario o con ANALYTICS_DISABLED no deja rastro', async () => {
    expect(await track({ id: 'd', app_metadata: { demo: true } }, 'share')).toBe(false)
    expect(await track(null, 'share')).toBe(false)
    process.env.ANALYTICS_DISABLED = '1'
    expect(await track({ id: 'u1' }, 'share')).toBe(false)
    expect(h.ops).toEqual([])
  })

  it('sin la tabla (migración sin aplicar), sin claves o con Supabase colgado: false y sin lanzar', async () => {
    h.results.analytics_events = [{ error: { code: '42P01', message: 'no existe' } }]
    expect(await track({ id: 'u1' }, 'share')).toBe(false)
    h.throwOnCreate = true
    expect(await track({ id: 'u1' }, 'share')).toBe(false)
    h.throwOnCreate = false
    vi.useFakeTimers()
    h.hang = true
    const pending = track({ id: 'u1' }, 'share')
    await vi.advanceTimersByTimeAsync(1600)
    expect(await pending).toBe(false)
  })

  it('cleanProps recorta textos largos', () => {
    expect(cleanProps({ a: 'x'.repeat(500) }).a).toHaveLength(120)
  })
})

describe('firma de la invitación', () => {
  it('estable por usuario, distinta entre usuarios y verificable', () => {
    const sig = inviteSignature('u1')!
    expect(sig).toMatch(/^[0-9a-f]{20}$/)
    expect(inviteSignature('u1')).toBe(sig)
    expect(inviteSignature('u2')).not.toBe(sig)
    expect(isValidInviteSignature('u1', sig)).toBe(true)
    expect(isValidInviteSignature('u1', sig.toUpperCase())).toBe(true)
    expect(isValidInviteSignature('u2', sig)).toBe(false)
    expect(isValidInviteSignature('u1', undefined)).toBe(false)
    expect(isValidInviteSignature('u1', 'corta')).toBe(false)
  })

  it('el enlace va al perfil público con ref e inv', () => {
    expect(invitePath('es', { id: 'u1', username: 'ana' })).toBe(`/es/u/ana?ref=ana&inv=${inviteSignature('u1')}`)
  })

  it('sin secreto no hay firma (y nada se acepta)', () => {
    delete process.env.INVITE_SECRET
    const prev = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(inviteSignature('u1')).toBeNull()
    expect(invitePath('en', { id: 'u1', username: 'ana' })).toBe('/en/u/ana?ref=ana')
    expect(isValidInviteSignature('u1', 'a'.repeat(20))).toBe(false)
    if (prev !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prev
  })
})

describe('acceptInvite()', () => {
  const NEW = { id: 'new-1' }

  it('firma válida: amistad aceptada quien invita → cuenta nueva y evento invite_accepted', async () => {
    h.results.users = [{ data: { id: 'inv-1', username: 'ana' } }, { data: { username: 'u_abc123' } }]
    h.results.friendships = [{ data: [] }, { error: null }]
    expect(await acceptInvite(NEW, 'ana', inviteSignature('inv-1')!)).toBe('accepted')
    expect(h.ops).toContainEqual({
      table: 'friendships', op: 'insert', row: { requester_id: 'inv-1', receiver_id: 'new-1', status: 'accepted' },
    })
    expect(h.ops).toContainEqual(expect.objectContaining({
      table: 'analytics_events', op: 'upsert', row: expect.objectContaining({ name: 'invite_accepted', user_id: 'new-1' }),
    }))
    // Sin INVITE_NOTIFY no se crea el aviso (la lista aún no sabe pintarlo).
    expect(h.ops.some((o) => o.table === 'notifications')).toBe(false)
  })

  it('con INVITE_NOTIFY=1 avisa a quien invitó', async () => {
    process.env.INVITE_NOTIFY = '1'
    h.results.users = [{ data: { id: 'inv-1', username: 'ana' } }, { data: { username: 'u_abc123' } }]
    h.results.friendships = [{ data: [] }, { error: null }]
    await acceptInvite(NEW, 'ana', inviteSignature('inv-1')!)
    expect(h.ops).toContainEqual({
      table: 'notifications', op: 'insert',
      row: { user_id: 'inv-1', type: 'invite_accepted', payload: { userId: 'new-1', fromUsername: 'u_abc123' } },
    })
  })

  it('un ref sin firma válida (p. ej. ?ref=<víctima>) nunca crea amistad', async () => {
    h.results.users = [{ data: { id: 'victima', username: 'vic' } }, { data: { id: 'victima', username: 'vic' } }]
    expect(await acceptInvite(NEW, 'vic', 'f'.repeat(20))).toBe('invalid')
    expect(await acceptInvite(NEW, 'vic', undefined)).toBe('invalid')
    expect(h.ops.some((o) => o.op === 'insert')).toBe(false)
  })

  it('nombre antiguo: se resuelve con username_redirect', async () => {
    h.results.users = [{ data: null }, { data: { id: 'inv-1', username: 'ana_nueva' } }, { data: { username: 'u_x' } }]
    h.rpc.mockResolvedValue({ data: 'ana_nueva', error: null })
    h.results.friendships = [{ data: [] }, { error: null }]
    expect(await acceptInvite(NEW, 'ana_vieja', inviteSignature('inv-1')!)).toBe('accepted')
    expect(h.rpc).toHaveBeenCalledWith('username_redirect', { p_username: 'ana_vieja' })
  })

  it('ya eran amigos (o había solicitud): no se duplica', async () => {
    h.results.users = [{ data: { id: 'inv-1', username: 'ana' } }]
    h.results.friendships = [{ data: [{ id: 'f1', status: 'pending' }] }]
    expect(await acceptInvite(NEW, 'ana', inviteSignature('inv-1')!)).toBe('already_friends')
    expect(h.ops.some((o) => o.op === 'insert')).toBe(false)
  })

  it('consigo mismo, no; y un fallo de la base no lanza', async () => {
    h.results.users = [{ data: { id: 'new-1', username: 'ana' } }]
    expect(await acceptInvite(NEW, 'ana', inviteSignature('new-1')!)).toBe('self')
    h.throwOnCreate = true
    expect(await acceptInvite(NEW, 'ana', inviteSignature('inv-1')!)).toBe('error')
  })
})
