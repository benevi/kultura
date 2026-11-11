// ============================================================
// KULTURA — Regresión: un usuario vetado que intenta entrar en un grupo
// público recibía 500. La RLS lo rechaza (42501): ahora 403 forbidden con
// message 'join_not_allowed' (contrato { error: { code, message } }).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { renderEs } from './intl'
import { GROUP_ERRORS } from '@/lib/api/contracts/groups'

const G1 = '11111111-1111-4111-8111-111111111111'

const { mockInsert, mockShow } = vi.hoisted(() => ({ mockInsert: vi.fn(), mockShow: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: '22222222-2222-4222-8222-222222222222' } }, error: null }) },
    from: () => ({ insert: mockInsert }),
  }),
}))
vi.mock('@/lib/social/groups', () => ({
  getGroupById: async () => ({ id: '11111111-1111-4111-8111-111111111111', isPublic: true }),
  getMemberRole: async () => null,
}))
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  checkRateLimitDistributed: async () => ({ allowed: true, retryAfterSeconds: 0 }),
}))
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
    const res = await POST(new Request(`http://localhost/api/groups/${G1}/join`, { method: 'POST' }) as never, {
      params: Promise.resolve({ id: G1 }),
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: { code: 'forbidden', message: GROUP_ERRORS.joinNotAllowed } })
  })

  it('otro error sigue siendo 500', async () => {
    mockInsert.mockResolvedValue({ error: { code: '08006', message: 'connection' } })
    const { POST } = await import('@/app/api/groups/[id]/join/route')
    const res = await POST(new Request(`http://localhost/api/groups/${G1}/join`, { method: 'POST' }) as never, {
      params: Promise.resolve({ id: G1 }),
    })
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe('internal')
  })

  it('el botón muestra el mensaje traducido con un 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ error: { code: 'forbidden', message: GROUP_ERRORS.joinNotAllowed } }),
      })
    )
    renderEs(<JoinGroupButton groupId={G1} isMember={false} isOwner={false} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unirse' }))
    })
    expect(mockShow).toHaveBeenCalledWith({
      message: 'No puedes unirte a este grupo. Si crees que es un error, habla con quien lo creó.',
      type: 'error',
    })
    vi.unstubAllGlobals()
  })

  it('un 403 sin join_not_allowed muestra el error genérico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({ error: { code: 'forbidden' } }),
      })
    )
    renderEs(<JoinGroupButton groupId={G1} isMember={false} isOwner={false} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unirse' }))
    })
    expect(mockShow).toHaveBeenCalledTimes(1)
    expect(mockShow.mock.calls[0][0].message).not.toBe(
      'No puedes unirte a este grupo. Si crees que es un error, habla con quien lo creó.'
    )
    vi.unstubAllGlobals()
  })
})
