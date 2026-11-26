// ============================================================
// KULTURA — Perfil en «Sala» (fase 8.5 P1): la cabecera de persona (franja
// con el color del avatar y su tinta, `h1` con el @nombre entero, sin botón de
// editar la bio), «Editar perfil» a Ajustes, los números en una lista
// nombrada y las filas de obras con nombre.
// ============================================================

import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('next-intl', () => {
  const t = (key: string, v?: Record<string, unknown>) => (v ? `${key}(${Object.values(v).join('|')})` : key)
  return { useTranslations: vi.fn(() => t), useLocale: () => 'es' }
})
vi.mock('@/components/sala/SalaWorkCard', () => ({
  SalaWorkCard: ({ title, href, formatLabel }: { title: string; href: string; formatLabel: string }) => (
    <a data-testid="card" href={href}>{title} · {formatLabel}</a>
  ),
  SalaWorkCardSkeleton: () => <div data-testid="skeleton" />,
}))

import {
  profileBand,
  SalaProfileEdit,
  SalaProfileHeader,
  SalaProfileNumbers,
  SalaProfileRow,
  SalaProfileState,
} from '@/components/profile/sala/SalaProfile'
import { AVATAR_COLORS } from '@/lib/constants/avatarColors'

describe('profileBand', () => {
  it('un color de la paleta: su valor y su tinta (la que ya cumple 4,5:1)', () => {
    const orange = AVATAR_COLORS.find((c) => c.name === 'orange')!
    expect(profileBand('orange')).toEqual({ backgroundColor: orange.value, color: orange.on })
  })
  it('un hex antiguo: el color y la tinta que mejor se lee', () => {
    expect(profileBand('#FFFF00')).toEqual({ backgroundColor: '#FFFF00', color: 'oklch(16% 0 0)' })
    expect(profileBand('#101010')).toEqual({ backgroundColor: '#101010', color: 'oklch(98% 0 0)' })
  })
  it('sin color reconocible: nada (la franja usa el panel de «Sala»)', () => {
    expect(profileBand(null)).toBeNull()
    expect(profileBand('no-es-un-color')).toBeNull()
  })
})

describe('SalaProfileHeader', () => {
  it('el h1 es el @nombre entero; la fecha y la bio, como texto; sin botón de editar la bio', () => {
    const { container } = render(
      <SalaProfileHeader
        username="un_nombre_de_usuario_muy_largo"
        avatarColor="blue"
        avatarInitials="UN"
        memberSince="Miembro desde octubre de 2026"
        bio="Cine y manga."
      >
        <SalaProfileEdit label="Editar perfil" />
      </SalaProfileHeader>
    )
    expect(screen.getByRole('heading', { level: 1, name: '@un_nombre_de_usuario_muy_largo' })).toBeInTheDocument()
    expect(screen.getByText('Miembro desde octubre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Cine y manga.')).toBeInTheDocument()
    // La única acción es «Editar perfil», que lleva a Ajustes: la bio ya no se edita aquí.
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', '/settings')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    // La franja lleva el color del avatar; el avatar, decorativo.
    const band = container.querySelector('[data-sala-profile-band]') as HTMLElement
    expect(band.style.backgroundColor).not.toBe('')
    expect(band.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('sin bio, sin fecha y sin acciones: no pinta huecos', () => {
    const { container } = render(<SalaProfileHeader username="ana" avatarColor="" avatarInitials="AN" memberSince={null} bio={null} />)
    expect(container.querySelector('[data-sala-profile-bio]')).toBeNull()
    expect(container.querySelector('[data-sala-profile-actions]')).toBeNull()
    expect((container.querySelector('[data-sala-profile-band]') as HTMLElement).className).toContain('bg-sala-panel')
  })
})

describe('SalaProfileNumbers', () => {
  it('una lista nombrada con cada número y su etiqueta', () => {
    render(
      <SalaProfileNumbers
        label="Su biblioteca en números"
        items={[{ value: 11, label: 'títulos' }, { value: 6, label: 'películas' }]}
      />
    )
    const region = screen.getByRole('region', { name: 'Su biblioteca en números' })
    const items = within(region).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['11títulos', '6películas'])
  })
  it('sin números, nada', () => {
    const { container } = render(<SalaProfileNumbers label="x" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SalaProfileRow', () => {
  it('una sección con su h2 y la lista de obras nombrada por él, también las que no tienen portada', () => {
    render(
      <SalaProfileRow
        title="Viendo ahora"
        name="watching"
        items={[
          { mediaId: 'anime_21', title: 'One Piece', poster: null, type: 'anime' },
          { mediaId: 'movie_603', title: 'Matrix', poster: 'https://x/p.jpg', type: 'movie' },
        ]}
      />
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Viendo ahora' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Viendo ahora' })).toBeInTheDocument()
    expect(screen.getAllByTestId('card').map((a) => a.getAttribute('href'))).toEqual(['/media/anime/21', '/media/movie/603'])
  })
  it('sin obras, no hay sección', () => {
    const { container } = render(<SalaProfileRow title="Viendo ahora" name="watching" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SalaProfileState', () => {
  it('un encabezado de sección con su explicación', () => {
    render(<SalaProfileState name="hidden" title="La biblioteca de ana no es pública" description="Solo la ven sus amigos." />)
    expect(screen.getByRole('heading', { level: 2, name: 'La biblioteca de ana no es pública' })).toBeInTheDocument()
    expect(screen.getByText('Solo la ven sus amigos.')).toBeInTheDocument()
  })
})
