// ============================================================
// KULTURA — Login: aviso tras borrar la cuenta o programar el borrado (ROJO-7)
// ============================================================

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeAuth } from '../auth/fake-auth'

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import('../auth/fake-auth').createFakeAuth>,
  params: new URLSearchParams(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => h.fake.client }))
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values && 'date' in values ? `${key}:${values.date}` : key
    t.rich = (key: string) => key
    return t
  },
}))
vi.mock('@/i18n/navigation', async () => {
  const m = await import('../auth/fake-auth')
  return { Link: m.FakeLink }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => h.params,
}))

import { LoginPage, welcomeHref } from '@/app/[locale]/login/LoginPage'

describe('LoginPage — avisos de cuenta', () => {
  beforeEach(() => {
    h.fake = createFakeAuth()
  })

  it('borrado programado: dice hasta cuándo se puede cancelar', () => {
    h.params = new URLSearchParams('account=deletion_scheduled&purge_at=2026-10-29T10%3A00%3A00.000Z')
    render(<LoginPage locale="es" />)
    expect(screen.getByRole('status')).toHaveTextContent('deletionScheduled:29 de octubre de 2026')
  })

  it('en inglés la fecha va en inglés', () => {
    h.params = new URLSearchParams('account=deletion_scheduled&purge_at=2026-10-29T10%3A00%3A00.000Z')
    render(<LoginPage locale="en" />)
    expect(screen.getByRole('status')).toHaveTextContent('deletionScheduled:29 October 2026')
  })

  it('cuenta borrada: lo confirma', () => {
    h.params = new URLSearchParams('account=deleted')
    render(<LoginPage locale="es" />)
    expect(screen.getByRole('status')).toHaveTextContent('accountDeleted')
  })

  it('una fecha basura no pinta nada', () => {
    h.params = new URLSearchParams('account=deletion_scheduled&purge_at=mañana')
    render(<LoginPage locale="es" />)
    expect(screen.queryByText(/deletionScheduled/)).not.toBeInTheDocument()
  })

  it('el destino viaja al onboarding como next', () => {
    expect(welcomeHref('es', '/es/u/benevi?x=1')).toBe('/es/welcome?next=%2Fes%2Fu%2Fbenevi%3Fx%3D1')
  })
})
