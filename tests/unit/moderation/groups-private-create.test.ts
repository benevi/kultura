// ============================================================
// KULTURA — Regresión: crear un grupo PRIVADO (F-11, pendiente de F-02)
//
// Un INSERT … RETURNING exige que la fila nueva pase la RLS de SELECT de
// `groups` (`is_public OR is_group_member(id, auth.uid())`). El dueño entra en
// group_members por el disparador AFTER INSERT, que se ejecuta DESPUÉS de esa
// comprobación: con `.insert().select()` un grupo privado fallaba con 42501.
// El mock reproduce ese comportamiento de Postgres.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const rows: Array<Record<string, unknown>> = []

const RLS_ERROR = { code: '42501', message: 'new row violates row-level security policy for table "groups"' }

function groupsTable() {
  return {
    insert: (row: Record<string, unknown>) => {
      const id = (row.id as string | undefined) ?? 'generated-id'
      const stored = { ...row, id, created_at: '2026-11-01T00:00:00Z', icon: null }
      // INSERT sin RETURNING: la fila se guarda y el disparador añade al dueño.
      const plain = Promise.resolve().then(() => {
        rows.push(stored)
        return { data: null, error: null }
      })
      return Object.assign(plain, {
        // INSERT … RETURNING: la RLS de SELECT se mira ANTES del disparador.
        select: () => ({
          single: async () =>
            row.is_public ? { data: stored, error: null } : { data: null, error: RLS_ERROR },
        }),
      })
    },
    select: () => ({
      eq: (_col: string, value: string) => ({
        maybeSingle: async () => ({ data: rows.find((r) => r.id === value) ?? null, error: null }),
        single: async () => {
          const found = rows.find((r) => r.id === value)
          return found ? { data: found, error: null } : { data: null, error: { code: 'PGRST116' } }
        },
      }),
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => (table === 'groups' ? groupsTable() : {}),
  }),
}))

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0, remaining: 1 }) }
})

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/groups', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/groups — grupo privado', () => {
  beforeEach(() => {
    rows.length = 0
    mockGetUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null })
  })

  it('crea un grupo privado aunque la RLS de SELECT no deje ver la fila en el RETURNING', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Club privado', is_public: false }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.group).toMatchObject({ name: 'Club privado', is_public: false, owner_id: 'owner-1' })
    expect(typeof body.group.id).toBe('string')
    expect(rows).toHaveLength(1)
  })

  it('el grupo público se sigue creando igual', async () => {
    const { POST } = await import('@/app/api/groups/route')
    const res = await POST(makeRequest({ name: 'Club público' }))
    expect(res.status).toBe(201)
    expect((await res.json()).group).toMatchObject({ name: 'Club público', is_public: true })
  })
})
