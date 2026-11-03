// Páginas compartidas como página impresa del álbum: una sola acción en rosa
// (la barra fija), cabecera sin «Registrarse», números solo si son reales y
// los títulos «en curso» como cromos puestos con su tira.
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { createTranslator } from 'next-intl'
import es from '../../../messages/es.json'

vi.mock('next-intl/server', () => {
  const t = (ns: string) => {
    const tr = createTranslator({ locale: 'es', messages: es, namespace: ns as never }) as unknown as {
      (k: string, v?: Record<string, unknown>): string
      rich: (k: string, v?: Record<string, unknown>) => React.ReactNode
    }
    const fn = (k: string, v?: Record<string, unknown>) => tr(k, v)
    return Object.assign(fn, { rich: (k: string, v?: Record<string, unknown>) => tr.rich(k, v) })
  }
  return {
    getTranslations: async (arg?: string | { namespace: string }) => t(typeof arg === 'string' ? arg : (arg?.namespace ?? '')),
    getLocale: async () => 'es',
  }
})
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/lib/motion/usePasteGrid', () => ({ usePasteGrid: () => {} }))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

import { AlbumNumbers, PublicBar, SignUpCta, WatchingRow } from '@/components/collection/PublicCollection'

describe('PublicBar', () => {
  it('sin sesión: logotipo y «Iniciar sesión» secundario que vuelve a la página; ningún rosa', async () => {
    const { container } = render(await PublicBar({ locale: 'es', signedIn: false, returnTo: '/es/u/ana' }))
    const login = screen.getByRole('link', { name: /Inicia sesión|Iniciar sesión|Entra/ })
    expect(login.getAttribute('href')).toBe('/es/login?mode=login&next=%2Fes%2Fu%2Fana')
    expect(container.innerHTML).not.toMatch(/bg-accent-pink/)
    expect(container.innerHTML).not.toMatch(/mode=register/)
  })
})

describe('SignUpCta', () => {
  it('la única acción en rosa, fija al pie (sticky, nunca tapa el pie) y con el margen seguro', async () => {
    const { container } = render(await SignUpCta({ href: '/login?mode=register', label: 'Empieza tu álbum, gratis' }))
    const bar = container.querySelector('[data-sticky-cta]')!
    expect(bar.className).toMatch(/\bsticky\b/)
    expect(bar.className).toMatch(/bottom-0/)
    expect(bar.className).toMatch(/safe-area-inset-bottom/)
    expect(container.querySelectorAll('.bg-accent-pink')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Empieza tu álbum, gratis' })).toHaveAttribute('href', '/login?mode=register')
  })
})

describe('AlbumNumbers', () => {
  it('cada cifra en su caja, dentro de su frase ICU, y nunca un cero', async () => {
    const node = await AlbumNumbers({
      locale: 'es',
      numbers: [
        { key: 'publicListsCount', count: 1 },
        { key: 'titlesCount', count: 1234 },
        { key: 'completedCount', count: 0 },
      ],
    })
    const { container } = render(node!)
    const items = Array.from(container.querySelectorAll('li')).map((li) => li.textContent)
    expect(items).toEqual(['1 lista pública', '1234 títulos'])
    expect(container.querySelectorAll('[data-number-badge]')).toHaveLength(2)
  })

  it('sin ninguna cifra real, no pinta nada', async () => {
    expect(await AlbumNumbers({ locale: 'es', numbers: [{ key: 'titlesCount', count: 0 }] })).toBeNull()
  })
})

describe('WatchingRow', () => {
  it('cromos puestos con su tira de avance y «hace N días» cuando se sabe', async () => {
    const node = await WatchingRow({
      locale: 'es',
      priorityCount: 0,
      items: [
        { mediaId: 'tv_1', title: 'Severance', poster: null, type: 'tv', progress: 0.4, updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
        { mediaId: 'book_2', title: 'Dune', poster: null, type: 'book' },
      ],
    })
    const { container } = render(node!)
    const cromos = container.querySelectorAll('[data-cromo]')
    expect(Array.from(cromos).map((c) => c.getAttribute('data-state'))).toEqual(['placed', 'placed'])
    expect(container.querySelectorAll('[data-progress-strip]')).toHaveLength(1)
    expect(screen.getByText('hace 3 días')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-status]')).toHaveLength(1)
  })
})
