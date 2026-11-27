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
  SalaWorkCard: ({ title, href, formatLabel, detail, headingLevel }: { title: string; href: string; formatLabel: string; detail?: string; headingLevel?: number }) => (
    <a data-testid="card" data-level={headingLevel} href={href}>{title} · {formatLabel}{detail ? ` · ${detail}` : ''}</a>
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
  SalaProfileGenres,
  SalaProfileFavorites,
  SalaProfileInvite,
  SalaProfileCta,
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

describe('SalaProfileGenres (P2)', () => {
  it('una lista nombrada por su h2, con el número de cada género escrito (no solo en `title`)', () => {
    render(
      <SalaProfileGenres
        title="Géneros favoritos"
        items={[
          { genre: 'Drama', count: '12 títulos' },
          { genre: 'Ciencia ficción', count: '1 título' },
        ]}
      />
    )
    const section = screen.getByRole('region', { name: 'Géneros favoritos' })
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent('Géneros favoritos')
    const items = within(section).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Drama · 12 títulos', 'Ciencia ficción · 1 título'])
    expect(section.querySelector('[title]')).toBeNull()
  })

  it('sin géneros no pinta nada', () => {
    const { container } = render(<SalaProfileGenres title="Géneros favoritos" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SalaProfileRow dentro de otra sección (P3)', () => {
  it('con `headingLevel={3}` el encabezado es h3 y las obras bajan a h4; la acción y la descripción a la vista', () => {
    render(
      <SalaProfileRow
        title="Pelis de domingo"
        name="list-l1"
        headingLevel={3}
        description="películas"
        action={<a href="/u/ana/l/l1">Ver lista</a>}
        items={[{ mediaId: 'movie_603', title: 'Matrix', poster: null, type: 'movie', year: 1999 }]}
      />
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Pelis de domingo' })).toBeInTheDocument()
    expect(screen.getByText('películas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver lista' })).toHaveAttribute('href', '/u/ana/l/l1')
    expect(screen.getByTestId('card')).toHaveAttribute('data-level', '4')
  })
})

describe('SalaProfileFavorites (P3)', () => {
  const items = [
    { mediaId: 'movie_603', title: 'Matrix', poster: null, type: 'movie', year: 1999, detail: 'Nota: 9 de 10' },
    { mediaId: 'game_1', title: 'Hades', poster: 'https://x/h.jpg', type: 'game', detail: 'Nota: 4,5 de 5' },
  ]
  it('una sección nombrada por su h2 con una lista de obras y la nota de su dueño escrita', () => {
    render(<SalaProfileFavorites title="Favoritos" items={items} hint="Puntúa títulos y los mejores saldrán aquí" />)
    const section = screen.getByRole('region', { name: 'Favoritos' })
    const cards = within(section).getAllByTestId('card')
    expect(cards.map((c) => c.textContent)).toEqual(['Matrix · movie · Nota: 9 de 10', 'Hades · game · Nota: 4,5 de 5'])
    expect(within(section).getAllByRole('listitem')).toHaveLength(2)
    expect(within(section).getByText('Puntúa títulos y los mejores saldrán aquí')).toBeInTheDocument()
  })
  it('sin favoritos no pinta nada', () => {
    const { container } = render(<SalaProfileFavorites title="Favoritos" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SalaProfileInvite y SalaProfileCta (P3)', () => {
  it('la invitación no es un encabezado (va antes del h1) y nombra su región; un enlace a registrarse', () => {
    render(<SalaProfileInvite title="ana te invita a KULTURA" text="Seréis amigos" cta="Crear mi cuenta" href="/login?mode=register&ref=ana" />)
    const aside = screen.getByRole('complementary', { name: 'ana te invita a KULTURA' })
    expect(within(aside).queryByRole('heading')).toBeNull()
    expect(within(aside).getByRole('link', { name: 'Crear mi cuenta' })).toHaveAttribute('href', '/login?mode=register&ref=ana')
  })
  it('la llamada del final es una sección con su h2', () => {
    render(<SalaProfileCta title="¿Y la tuya?" text="Guarda todo" cta="Crea tu colección" href="/login?mode=register" />)
    const section = screen.getByRole('region', { name: '¿Y la tuya?' })
    expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent('¿Y la tuya?')
    expect(within(section).getByRole('link', { name: 'Crea tu colección' })).toHaveAttribute('href', '/login?mode=register')
  })
})
