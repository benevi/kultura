// ============================================================
// KULTURA — ProfileGenres unit tests
// Verifica el renderizado de géneros favoritos como chips.
// ============================================================

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  getLocale: () => Promise.resolve('es'),
}))

import { ProfileGenres } from '@/components/profile/ProfileGenres'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfileGenres', () => {
  it('retorna null si topGenres está vacío', async () => {
    const result = await ProfileGenres({ topGenres: [] })
    expect(result).toBeNull()
  })

  it('renderiza los géneros proporcionados', async () => {
    const topGenres = [
      { genre: 'Action', count: 10 },
      { genre: 'Drama', count: 6 },
    ]
    const component = await ProfileGenres({ topGenres })
    render(component!)
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('Drama')).toBeInTheDocument()
  })

  it('renderiza chips con clase bg-surface2', async () => {
    const topGenres = [
      { genre: 'Action', count: 10 },
      { genre: 'Drama', count: 5 },
    ]
    const component = await ProfileGenres({ topGenres })
    const { container } = render(component!)
    const chips = container.querySelectorAll('.bg-surface2')
    expect(chips.length).toBeGreaterThanOrEqual(2)
  })

  it('muestra máximo 8 géneros aunque haya más', async () => {
    const topGenres = Array.from({ length: 12 }, (_, i) => ({
      genre: `Genre${i}`,
      count: 10 - i,
    }))
    const component = await ProfileGenres({ topGenres })
    render(component!)
    // Solo los 8 primeros deben aparecer
    expect(screen.getByText('Genre0')).toBeInTheDocument()
    expect(screen.getByText('Genre7')).toBeInTheDocument()
    expect(screen.queryByText('Genre8')).not.toBeInTheDocument()
  })
})
