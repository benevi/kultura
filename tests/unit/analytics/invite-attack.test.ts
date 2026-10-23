// Reproduce el ataque de la revisión del PR #39: una cuenta ANTIGUA que no
// terminó el onboarding (`onboarded_at` NULL, creada hace días) entra por
// `flow=signup` con un `ref` y un `inv` firmados y válidos. No debe crearse
// ninguna amistad. Sin mocks de signup/invite: corre el código real hasta el
// cliente admin, que registra cada escritura.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  writes: [] as Array<{ table: string; op: string; row: unknown }>,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: h.user } }),
      updateUser: async () => ({ data: {}, error: null }),
    },
    from: (table: string) => {
      if (table === 'account_state') {
        // La cuenta existe y NO ha terminado el onboarding.
        const c = { select: () => c, eq: () => c, maybeSingle: async () => ({ data: { onboarded_at: null }, error: null }) }
        return c
      }
      const u = { update: () => u, eq: () => u, is: async () => ({ error: null }) }
      return u
    },
  }),
}))

function adminBuilder(table: string) {
  const result = () => {
    if (table === 'users') return { data: { id: 'inviter-1', username: 'ana' }, error: null }
    return { data: [], error: null } // sin amistad previa ni bloqueos
  }
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'or', 'limit']) b[m] = () => b
  b.maybeSingle = async () => result()
  b.then = (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve)
  const write = (op: string) => (row: unknown) => {
    h.writes.push({ table, op, row })
    return Promise.resolve({ data: null, error: null })
  }
  b.insert = write('insert')
  b.upsert = write('upsert')
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: adminBuilder, rpc: async () => ({ data: null, error: null }) }),
}))

import { GET } from '@/app/api/auth/callback/route'
import { inviteSignature } from '@/lib/analytics/invite'

const DAY = 86_400_000

function attack() {
  // Firma real y vigente del enlace de "ana" (la que reparte Amigos).
  const inv = inviteSignature('inviter-1', 'ana')!
  const q = new URLSearchParams({ flow: 'signup', next: '/es/home', ref: 'ana', inv })
  return GET(
    new NextRequest(`https://k.test/api/auth/callback?${q.toString()}`, {
      headers: { 'sec-fetch-site': 'same-origin' },
    }),
  )
}

const friendshipWrites = () => h.writes.filter((w) => w.table === 'friendships')

beforeEach(() => {
  h.writes.length = 0
  process.env.INVITE_SECRET = 'secreto-de-prueba'
})
afterEach(() => {
  delete process.env.INVITE_SECRET
})

describe('ataque: cuenta antigua sin onboarding + flow=signup + invitación válida', () => {
  it('no crea ninguna amistad ni registra un alta', async () => {
    h.user = {
      id: 'old-1',
      created_at: new Date(Date.now() - 5 * DAY).toISOString(),
      email_confirmed_at: new Date(Date.now() - 5 * DAY).toISOString(),
      app_metadata: { provider: 'email' },
      user_metadata: {},
    }
    await attack()
    expect(friendshipWrites()).toEqual([])
    expect(h.writes.filter((w) => w.table === 'analytics_events')).toEqual([])
  })

  it('control: la misma petición con una cuenta recién creada sí crea la amistad', async () => {
    h.user = {
      id: 'new-1',
      created_at: new Date(Date.now() - 60_000).toISOString(),
      app_metadata: { provider: 'email' },
      user_metadata: {},
    }
    await attack()
    expect(friendshipWrites()).toEqual([
      { table: 'friendships', op: 'insert', row: { requester_id: 'inviter-1', receiver_id: 'new-1', status: 'accepted' } },
    ])
  })
})
