// ============================================================
// KULTURA — Inicio (F-12): respaldo del perfil sin el email (R4) y aviso de
// borrado programado (ROJO-7)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'

const h = vi.hoisted(() => ({
  profile: null as unknown,
  account: { data: null as unknown, error: null as unknown },
  insert: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'es',
  getTranslations: async () => (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
}))
vi.mock('@/lib/claude/recommendations', () => ({
  MIN_LIBRARY_ITEMS: 3,
  readTodayAiRecommendations: async () => null,
}))
vi.mock('@/lib/recommendations/starter', () => ({ getStarterItems: async () => [] }))
vi.mock('@/components/home/AiRecommendations', () => ({ AiRecommendations: () => null }))
vi.mock('@/components/home/HeroSection', () => ({ HeroSection: () => null }))
vi.mock('@/components/home/MediaRow', () => ({ MediaRow: () => null }))
vi.mock('@/components/home/PopularInCircle', () => ({ PopularInCircle: () => null }))
vi.mock('@/components/home/GenreNews', () => ({ GenreNews: () => null }))
vi.mock('@/i18n/navigation', () => ({ Link: ({ children }: { children: ReactNode }) => children }))

function chain(final: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) c[m] = () => c
  c.maybeSingle = async () => final
  c.or = async () => ({ count: 5, error: null })
  return c
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1', email: 'nombre.apellido@gmail.com' } } }),
      signOut: h.signOut,
    },
    from: (table: string) =>
      table === 'users'
        ? chain({ data: h.profile })
        : table === 'account_state'
          ? chain(h.account)
          : chain({ data: null }),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: h.insert,
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    }),
  }),
}))

import HomePage from '@/app/[locale]/(app)/home/page'

function texts(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(texts).join(' ')
  return texts((node as ReactElement<{ children?: ReactNode }>).props?.children)
}

describe('Inicio — identidad', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.profile = { id: 'user-1', username: 'ana' }
    h.account = { data: null, error: null }
    h.insert.mockResolvedValue({ error: null })
  })

  it('sin fila en users crea un nombre generado, NUNCA la parte local del email', async () => {
    h.profile = null
    await HomePage()
    expect(h.insert).toHaveBeenCalledOnce()
    const row = h.insert.mock.calls[0][0]
    expect(row.username).toMatch(/^u_[a-z0-9]{6}$/)
    expect(row.username).not.toContain('nombre')
    expect(row.avatar_initials).not.toBe('NO')
  })

  it('si el nombre aleatorio choca, reintenta con otro', async () => {
    h.profile = null
    h.insert.mockResolvedValueOnce({ error: { code: '23505' } }).mockResolvedValueOnce({ error: null })
    await HomePage()
    expect(h.insert).toHaveBeenCalledTimes(2)
    expect(h.insert.mock.calls[0][0].username).not.toBe(h.insert.mock.calls[1][0].username)
  })

  it('si no se puede crear, cierra sesión y vuelve al login', async () => {
    h.profile = null
    h.insert.mockResolvedValue({ error: { code: '42501' } })
    await expect(HomePage()).rejects.toThrow('REDIRECT /login')
    expect(h.signOut).toHaveBeenCalled()
  })

  it('con perfil no toca nada', async () => {
    await HomePage()
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('borrado programado → aviso con la fecha del borrado y salida a Ajustes', async () => {
    h.account = { data: { deletion_requested_at: '2026-10-22T10:00:00.000Z' }, error: null }
    const text = texts(await HomePage())
    expect(text).toContain('deletionPending:{"date":"29 de octubre de 2026"}')
    expect(text).toContain('cancelDeletion')
  })

  it('sin borrado pendiente (o sin la tabla) no hay aviso', async () => {
    h.account = { data: null, error: { code: '42P01' } }
    expect(texts(await HomePage())).not.toContain('deletionPending')
  })
})
