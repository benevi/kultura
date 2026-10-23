// F-17: pendientes de F-12 en el perfil con sesión.
//  - ProfileHeader enseñaba "0 títulos" con la biblioteca oculta (D-04b).
//  - ProfileGenres tenía "N títulos" en español fijo (TXT-4).
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key)),
  getLocale: () => Promise.resolve('en'),
}))
vi.mock('@/components/profile/ProfileBio', () => ({ ProfileBio: () => null }))
vi.mock('@/components/ui/Avatar', () => ({ Avatar: () => null }))

import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ProfileGenres } from '@/components/profile/ProfileGenres'

const base = {
  userId: 'u1', username: 'ana', avatarColor: '#000', avatarInitials: 'AN', createdAt: '2026-01-01T00:00:00Z',
  bio: null, isOwner: false, totalItems: 0, totalCompleted: 0, totalInProgress: 0,
}

describe('ProfileHeader — contadores y biblioteca oculta', () => {
  it('con la biblioteca oculta no pinta contadores (no "0 títulos" falso)', async () => {
    render(await ProfileHeader({ ...base, showCounters: false }))
    expect(screen.queryByText('totalItems')).not.toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('por defecto los pinta como siempre', async () => {
    render(await ProfileHeader({ ...base, totalItems: 7 }))
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('totalItems')).toBeInTheDocument()
  })
})

describe('ProfileGenres — texto traducido', () => {
  it('el título de cada chip sale de los mensajes, con plural', async () => {
    render((await ProfileGenres({ topGenres: [{ genre: 'Drama', count: 3 }] }))!)
    expect(screen.getByText('Drama')).toHaveAttribute('title', 'genreCount:{"count":3}')
  })
})
