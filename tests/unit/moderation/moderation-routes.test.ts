// ============================================================
// KULTURA — Rutas de moderación (F-11): bloquear, salir, borrar, expulsar
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeSupabase, type Handler, type QueryCall } from './supabase-mock'

const { current } = vi.hoisted(() => ({
  current: { client: null as unknown, calls: [] as unknown[] },
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: () => current.client }))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0, remaining: 1 }) }
})

const ME = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'
const GROUP = 'eeeeeeee-0000-4000-8000-000000000005'
const POST_ID = 'ffffffff-0000-4000-8000-000000000006'

let calls: QueryCall[] = []
function setup(handler: Handler, user: { id: string } | null = { id: ME }) {
  const mock = makeSupabase({ user, handler })
  current.client = mock.client
  calls = mock.calls
}

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const params = <T,>(p: T) => ({ params: Promise.resolve(p) })

afterEach(() => {
  delete process.env.MODERATION_V2
})

// ── /api/friends/blocks ─────────────────────────────────────────────────────
describe('/api/friends/blocks', () => {
  it('sin MODERATION_V2: GET dice enabled:false y POST no hace nada (404)', async () => {
    setup(() => ({}))
    const { GET, POST } = await import('@/app/api/friends/blocks/route')
    const g = await GET(jsonReq(`/api/friends/blocks?userId=${OTHER}`, 'GET'))
    expect(await g.json()).toEqual({ enabled: false, blocked: false })
    const p = await POST(jsonReq('/api/friends/blocks', 'POST', { userId: OTHER }))
    expect(p.status).toBe(404)
    expect(calls.filter((c) => c.table === 'blocks')).toHaveLength(0)
  })

  it('con bandera pero sin la tabla (migración pendiente) → enabled:false', async () => {
    process.env.MODERATION_V2 = '1'
    setup((c) => (c.table === 'blocks' ? { error: { code: 'PGRST205', message: 'no table' } } : {}))
    const { GET } = await import('@/app/api/friends/blocks/route')
    const g = await GET(jsonReq(`/api/friends/blocks?userId=${OTHER}`, 'GET'))
    expect(await g.json()).toEqual({ enabled: false, blocked: false })
  })

  it('bloquear: inserta la fila propia y borra la amistad en los dos sentidos', async () => {
    process.env.MODERATION_V2 = '1'
    setup((c) => (c.table === 'users' ? { data: { id: OTHER } } : {}))
    const { POST } = await import('@/app/api/friends/blocks/route')
    const res = await POST(jsonReq('/api/friends/blocks', 'POST', { userId: OTHER }))
    expect(res.status).toBe(200)
    const block = calls.find((c) => c.table === 'blocks')!
    expect(block.op).toBe('upsert')
    expect(block.payload).toEqual({ blocker_id: ME, blocked_id: OTHER })
    const del = calls.find((c) => c.table === 'friendships')!
    expect(del.op).toBe('delete')
    expect(del.or).toContain(`requester_id.eq.${ME},receiver_id.eq.${OTHER}`)
    expect(del.or).toContain(`requester_id.eq.${OTHER},receiver_id.eq.${ME}`)
  })

  it('no se bloquea uno a sí mismo', async () => {
    process.env.MODERATION_V2 = '1'
    setup(() => ({}))
    const { POST } = await import('@/app/api/friends/blocks/route')
    expect((await POST(jsonReq('/api/friends/blocks', 'POST', { userId: ME }))).status).toBe(400)
  })

  it('desbloquear borra solo la fila propia', async () => {
    process.env.MODERATION_V2 = '1'
    setup(() => ({}))
    const { DELETE } = await import('@/app/api/friends/blocks/route')
    const res = await DELETE(jsonReq('/api/friends/blocks', 'DELETE', { userId: OTHER }))
    expect(res.status).toBe(200)
    expect(calls[0]).toMatchObject({ table: 'blocks', op: 'delete', filters: { blocker_id: ME, blocked_id: OTHER } })
  })

  it('GET sin userId lista los bloqueados', async () => {
    process.env.MODERATION_V2 = '1'
    setup((c) =>
      c.table === 'blocks'
        ? { data: [{ blocked: { id: OTHER, username: 'troll', avatar_color: '#000', avatar_initials: 'TR' } }] }
        : {},
    )
    const { GET } = await import('@/app/api/friends/blocks/route')
    const res = await GET(jsonReq('/api/friends/blocks', 'GET'))
    expect(await res.json()).toEqual({
      enabled: true,
      users: [{ id: OTHER, username: 'troll', avatarColor: '#000', avatarInitials: 'TR' }],
    })
  })
})

// ── /api/friends POST con bloqueo ───────────────────────────────────────────
describe('POST /api/friends con bloqueo', () => {
  it('si la RLS rechaza la solicitud (bloqueo) → 403 genérico, sin revelar el bloqueo', async () => {
    setup((c) => {
      if (c.table === 'users') return { data: { id: OTHER } }
      if (c.table === 'friendships' && c.op === 'select') return { data: null }
      if (c.table === 'friendships' && c.op === 'insert') return { error: { code: '42501', message: 'rls' } }
      return {}
    })
    const { POST } = await import('@/app/api/friends/route')
    const res = await POST(jsonReq('/api/friends', 'POST', { receiverId: OTHER }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'not_allowed' })
  })
})

// ── /api/chat/[id] ──────────────────────────────────────────────────────────
describe('/api/chat/[id]', () => {
  const CONV = 'conv-1'

  it('POST: tras bloquear o dejar de ser amigos la RLS rechaza el mensaje → 403 cannot_message', async () => {
    setup((c) => {
      if (c.table === 'conversation_members') return { data: { user_id: ME } }
      if (c.table === 'messages' && c.op === 'insert') return { error: { code: '42501', message: 'rls' } }
      return {}
    })
    const { POST } = await import('@/app/api/chat/[id]/route')
    const res = await POST(jsonReq(`/api/chat/${CONV}`, 'POST', { content: 'hola' }), params({ id: CONV }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'cannot_message' })
  })

  it('DELETE (salir) sin MODERATION_V2 → 404 y no toca nada', async () => {
    setup(() => ({}))
    const { DELETE } = await import('@/app/api/chat/[id]/route')
    const res = await DELETE(jsonReq(`/api/chat/${CONV}`, 'DELETE'), params({ id: CONV }))
    expect(res.status).toBe(404)
    expect(calls).toHaveLength(0)
  })

  it('DELETE (salir) borra SOLO la pertenencia propia', async () => {
    process.env.MODERATION_V2 = '1'
    setup((c) => (c.table === 'conversation_members' && c.op === 'delete' ? { data: [{ conversation_id: CONV }] } : {}))
    const { DELETE } = await import('@/app/api/chat/[id]/route')
    const res = await DELETE(jsonReq(`/api/chat/${CONV}`, 'DELETE'), params({ id: CONV }))
    expect(res.status).toBe(200)
    expect(calls[0]).toMatchObject({
      table: 'conversation_members',
      op: 'delete',
      filters: { conversation_id: CONV, user_id: ME },
      returning: true,
    })
  })

  it('DELETE de una conversación a la que no pertenece → 403', async () => {
    process.env.MODERATION_V2 = '1'
    setup(() => ({ data: [] }))
    const { DELETE } = await import('@/app/api/chat/[id]/route')
    const res = await DELETE(jsonReq(`/api/chat/${CONV}`, 'DELETE'), params({ id: CONV }))
    expect(res.status).toBe(403)
  })

  it('borrar un mensaje filtra por remitente = yo (nunca lo ajeno)', async () => {
    process.env.MODERATION_V2 = '1'
    setup((c) => (c.table === 'messages' ? { data: [{ id: 'm1' }] } : {}))
    const { DELETE } = await import('@/app/api/chat/[id]/messages/[messageId]/route')
    const res = await DELETE(jsonReq(`/api/chat/${CONV}/messages/m1`, 'DELETE'), params({ id: CONV, messageId: 'm1' }))
    expect(res.status).toBe(200)
    expect(calls[0]).toMatchObject({ op: 'delete', filters: { id: 'm1', conversation_id: CONV, sender_id: ME } })
  })

  it('borrar un mensaje ajeno o inexistente → 404', async () => {
    process.env.MODERATION_V2 = '1'
    setup(() => ({ data: [] }))
    const { DELETE } = await import('@/app/api/chat/[id]/messages/[messageId]/route')
    const res = await DELETE(jsonReq(`/api/chat/${CONV}/messages/m2`, 'DELETE'), params({ id: CONV, messageId: 'm2' }))
    expect(res.status).toBe(404)
  })
})

// ── Grupos: borrar posts y expulsar ─────────────────────────────────────────
function groupHandler(opts: { author: string; roles: Record<string, 'owner' | 'member'>; deleted?: boolean }): Handler {
  return (c) => {
    if (c.table === 'group_posts' && c.op === 'select') return { data: { id: POST_ID, user_id: opts.author } }
    if (c.table === 'group_posts' && c.op === 'delete') return { data: opts.deleted === false ? [] : [{ id: POST_ID }] }
    if (c.table === 'group_members' && c.op === 'select') {
      const role = opts.roles[c.filters.user_id as string]
      return { data: role ? { role } : null }
    }
    if (c.table === 'group_members' && c.op === 'delete') {
      delete opts.roles[c.filters.user_id as string]
      return {}
    }
    return {}
  }
}

describe('DELETE /api/groups/[id]/posts/[postId]', () => {
  const call = async () => {
    const { DELETE } = await import('@/app/api/groups/[id]/posts/[postId]/route')
    return DELETE(jsonReq(`/api/groups/${GROUP}/posts/${POST_ID}`, 'DELETE'), params({ id: GROUP, postId: POST_ID }))
  }

  it('el autor borra su post (también sin bandera: la base ya lo permitía)', async () => {
    setup(groupHandler({ author: ME, roles: { [ME]: 'member' } }))
    expect((await call()).status).toBe(200)
  })

  it('un miembro que no es dueño NO borra un post ajeno', async () => {
    process.env.MODERATION_V2 = '1'
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'member', [OTHER]: 'member' } }))
    expect((await call()).status).toBe(403)
    expect(calls.some((c) => c.table === 'group_posts' && c.op === 'delete')).toBe(false)
  })

  it('el dueño borra un post ajeno con MODERATION_V2', async () => {
    process.env.MODERATION_V2 = '1'
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'owner', [OTHER]: 'member' } }))
    expect((await call()).status).toBe(200)
  })

  it('sin MODERATION_V2 el dueño todavía no borra lo ajeno (la política llega con la migración)', async () => {
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'owner', [OTHER]: 'member' } }))
    expect((await call()).status).toBe(403)
  })

  it('si la RLS no deja borrar (0 filas) → 403, no 200', async () => {
    process.env.MODERATION_V2 = '1'
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'owner' }, deleted: false }))
    expect((await call()).status).toBe(403)
  })
})

describe('DELETE /api/groups/[id]/members/[userId]', () => {
  const call = async (target: string) => {
    const { DELETE } = await import('@/app/api/groups/[id]/members/[userId]/route')
    return DELETE(jsonReq(`/api/groups/${GROUP}/members/${target}`, 'DELETE'), params({ id: GROUP, userId: target }))
  }

  beforeEach(() => {
    process.env.MODERATION_V2 = '1'
  })

  it('el dueño expulsa: veta (group_bans) y borra la pertenencia', async () => {
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'owner', [OTHER]: 'member' } }))
    const res = await call(OTHER)
    expect(res.status).toBe(200)
    expect(calls.find((c) => c.table === 'group_bans')).toMatchObject({
      op: 'upsert',
      payload: { group_id: GROUP, user_id: OTHER, banned_by: ME },
    })
    expect(calls.find((c) => c.table === 'group_members' && c.op === 'delete')).toMatchObject({
      filters: { group_id: GROUP, user_id: OTHER },
    })
  })

  it('nunca sobre sí mismo ni sobre el dueño; un no-dueño no expulsa', async () => {
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'owner', [OTHER]: 'owner' } }))
    expect((await call(ME)).status).toBe(400)
    expect((await call(OTHER)).status).toBe(400)
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'member', [OTHER]: 'member' } }))
    expect((await call(OTHER)).status).toBe(403)
  })

  it('sin MODERATION_V2 → 404', async () => {
    delete process.env.MODERATION_V2
    setup(groupHandler({ author: OTHER, roles: { [ME]: 'owner', [OTHER]: 'member' } }))
    expect((await call(OTHER)).status).toBe(404)
  })
})
