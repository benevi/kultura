import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Con los valores a la vista: «En KULTURA desde {date}» es UN mensaje (WIG).
vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: Record<string, unknown>) =>
      values && 'date' in values ? `${key}:${String(values.date)}` : key,
    ),
  getLocale: () => Promise.resolve('es'),
}))

// Mock ProfileBio to control bio/isOwner rendering in isolation
vi.mock('@/components/profile/ProfileBio', () => ({
  ProfileBio: ({
    bio,
    isOwner,
  }: {
    bio: string | null
    isOwner: boolean
    userId: string
  }) => {
    if (bio) return <p data-testid="profile-bio">{bio}</p>
    if (isOwner) return <a href="/settings" data-testid="add-bio">editBio</a>
    return null
  },
}))

vi.mock('@/components/ui/Avatar', () => ({
  Avatar: ({ initials }: { initials: string }) => (
    <div data-testid="avatar">{initials}</div>
  ),
}))

import { ProfileHeader } from '@/components/profile/ProfileHeader'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseProps = {
  userId: 'user-1',
  username: 'testuser',
  avatarColor: '#E82020',
  avatarInitials: 'TU',
  createdAt: '2024-01-15T00:00:00Z',
  bio: null,
  isOwner: false,
  totalItems: 42,
  totalCompleted: 30,
  totalInProgress: 5,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfileHeader', () => {
  it('sin fecha de alta (o inválida) no pinta «Miembro desde» ni se inventa una', async () => {
    for (const createdAt of [null, '', 'no-es-fecha']) {
      const { container, unmount } = render(await ProfileHeader({ ...baseProps, createdAt }))
      expect(container.textContent).not.toContain('memberSince')
      expect(container.textContent).not.toContain(String(new Date().getFullYear()))
      unmount()
    }
  })

  it('con fecha de alta sí la pinta', async () => {
    const { container } = render(await ProfileHeader(baseProps))
    expect(container.textContent).toContain('memberSince')
    expect(container.textContent).toContain('2024')
  })

  it('renderiza el username', async () => {
    render(await ProfileHeader(baseProps))
    expect(screen.getByText('testuser')).toBeInTheDocument()
  })

  it('renderiza el avatar con las iniciales', async () => {
    render(await ProfileHeader(baseProps))
    expect(screen.getByTestId('avatar')).toHaveTextContent('TU')
  })

  it('con bio muestra la bio', async () => {
    render(await ProfileHeader({ ...baseProps, bio: 'Mi biografía de prueba' }))
    expect(screen.getByTestId('profile-bio')).toHaveTextContent('Mi biografía de prueba')
  })

  it('sin bio + perfil propio muestra link añadir bio', async () => {
    render(await ProfileHeader({ ...baseProps, bio: null, isOwner: true }))
    expect(screen.getByTestId('add-bio')).toBeInTheDocument()
  })

  it('sin bio + perfil ajeno no muestra link añadir bio', async () => {
    render(await ProfileHeader({ ...baseProps, bio: null, isOwner: false }))
    expect(screen.queryByTestId('add-bio')).not.toBeInTheDocument()
  })

  it('stats muestran totalItems correcto', async () => {
    render(await ProfileHeader(baseProps))
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('stats muestran totalCompleted correcto', async () => {
    render(await ProfileHeader(baseProps))
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('stats muestran totalInProgress correcto', async () => {
    render(await ProfileHeader(baseProps))
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('botón "Editar perfil" no visible en perfil ajeno', async () => {
    render(await ProfileHeader({ ...baseProps, isOwner: false }))
    // El botón "editProfile" solo está en profile/page.tsx, no en ProfileHeader.
    // ProfileHeader no renderiza ese botón — lo hace la page.
    // Este test verifica que no hay ningún link a /settings fuera de ProfileBio.
    const links = screen.queryAllByRole('link')
    const settingsLinks = links.filter(l => l.getAttribute('href') === '/settings')
    expect(settingsLinks).toHaveLength(0)
  })

  it('muestra fecha de creación formateada dentro del mensaje (no concatenada)', async () => {
    render(await ProfileHeader(baseProps))
    expect(screen.getByText('memberSince:enero de 2024')).toBeInTheDocument()
  })

  it('las cifras van en sus cajas de número con el formato del idioma', async () => {
    const { container } = render(await ProfileHeader({ ...baseProps, totalItems: 1234 }))
    const badges = Array.from(container.querySelectorAll('[data-number-badge]')).map((b) => b.textContent)
    expect(badges).toEqual(['1234', '30', '5'].map((n) => new Intl.NumberFormat('es').format(Number(n))))
  })

  it('sin banda de héroe con degradado (DISENO.md: sin degradados fuera del brillo)', async () => {
    const { container } = render(await ProfileHeader(baseProps))
    expect(container.innerHTML).not.toMatch(/gradient/)
  })
})
