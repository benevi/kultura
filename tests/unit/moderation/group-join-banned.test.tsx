// ============================================================
// KULTURA — Regresión: un usuario vetado que intenta entrar en un grupo
// público recibía 500. La RLS lo rechaza (42501): ahora 403 con mensaje.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { renderEs } from './intl'

const { mockInsert, mockShow } = vi.hoisted(() => ({ mockInsert: vi.fn(), mockShow: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'vetado' } }, error: null }) },
    from: () => ({ insert: mockInsert }),
  }),
}))
vi.mock('@/lib/social/groups', () => ({
  getGroupById: async () => ({ id: 'g1', isPublic: true }),
  getMemberRole: async () => null,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>()
  return { ...actual, checkRateLimit: () => ({ allowed: true, retryAfterSeconds: 0, remaining: 1 }) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/ui/ToastProvider', () => ({ useToastContext: () => ({ show: mockShow }) }))

import { JoinGroupButton } from '@/app/[locale]/(app)/groups/[id]/JoinGroupButton'

beforeEach(() => {
  mockInsert.mockReset()
  mockShow.mockReset()
})

describe('POST /api/groups/[id]/join — vetado', () => {
  it('la RLS rechaza (42501) → 403 join_not_allowed, no 500', async () => {
    mockInsert.mockResolvedValue({ error: { code: '42501', message: 'new row violates row-level security policy' } })
    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(new Request('http://localhost/api/groups/g1/join', { method: 'POST' }) as never, {
      params: Promise.resolve({ id: 'g1' }),
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'join_not_allowed' })
  })

  it('otro error sigue siendo 500', async () => {
    mockInsert.mockResolvedValue({ error: { code: '08006', message: 'connection' } })
    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(new Request('http://localhost/api/groups/g1/join', { method: 'POST' }) as never, {
      params: Promise.resolve({ id: 'g1' }),
    })
    expect(res.status).toBe(500)
  })

  it('el botón muestra el mensaje traducido con un 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'join_not_allowed' }) }))
    renderEs(<JoinGroupButton groupId="g1" isMember={false} isOwner={false} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unirse' }))
    })
    expect(mockShow).toHaveBeenCalledWith({
      message: 'No puedes unirte a este grupo. Si crees que es un error, habla con quien lo creó.',
      type: 'error',
    })
    vi.unstubAllGlobals()
  })
})
