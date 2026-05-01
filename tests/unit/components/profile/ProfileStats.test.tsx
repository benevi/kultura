// ============================================================
// KULTURA — ProfileStats unit tests
// Verifica el renderizado de estadísticas por tipo de medio.
// ============================================================

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { TypeStats } from '@/lib/library/stats'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  getLocale: () => Promise.resolve('es'),
}))

import { ProfileStats } from '@/components/profile/ProfileStats'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockByType: TypeStats[] = [
  { type: 'movie', total: 10, completed: 8 },
  { type: 'book', total: 5, completed: 3 },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfileStats', () => {
  it('muestra estado vacío si byType está vacío', async () => {
    const component = await ProfileStats({ byType: [], totalItems: 0 })
    render(component)
    expect(screen.getByText('noStats')).toBeInTheDocument()
  })

  it('renderiza una card por tipo', async () => {
    const component = await ProfileStats({ byType: mockByType, totalItems: 15 })
    render(component)
    expect(screen.getByText('movie')).toBeInTheDocument()
    expect(screen.getByText('book')).toBeInTheDocument()
  })

  it('no renderiza tipos con total = 0', async () => {
    const byTypeWithZero: TypeStats[] = [
      { type: 'movie', total: 5, completed: 2 },
      { type: 'game', total: 0, completed: 0 },
    ]
    const component = await ProfileStats({ byType: byTypeWithZero, totalItems: 5 })
    render(component)
    expect(screen.getByText('movie')).toBeInTheDocument()
    expect(screen.queryByText('game')).not.toBeInTheDocument()
  })

  it('muestra el número de completados para cada tipo', async () => {
    const component = await ProfileStats({ byType: mockByType, totalItems: 15 })
    render(component)
    // The component renders "{s.completed} {t('completed')}" in the same <p>
    // So it appears as "8 completed" (where 'completed' is the i18n key via passthrough mock)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText(/^8\s+completed$/)).toBeInTheDocument()
  })

  it('renderiza múltiples tipos en orden', async () => {
    const component = await ProfileStats({ byType: mockByType, totalItems: 15 })
    render(component)
    const cards = screen.getAllByText(/movie|book/)
    expect(cards[0]).toHaveTextContent('movie')
    expect(cards[1]).toHaveTextContent('book')
  })
})
