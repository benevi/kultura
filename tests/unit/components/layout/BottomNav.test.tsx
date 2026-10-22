// ============================================================
// KULTURA — BottomNav (móvil): mismos 5 destinos que NavLinks (DIS-9),
// activo por prefijo y re-toque que sube al principio (MOV-7).
// ============================================================

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
      home: 'Inicio',
      discover: 'Descubrir',
      libraryTab: 'Biblioteca',
      lists: 'Listas',
      profileTab: 'Perfil',
      primaryNav: 'Navegación principal',
    }
    return map[key] ?? key
  }),
}))

const mockPathname = vi.hoisted(() => ({ value: '/home' }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, onClick, ...rest }: { href: string; children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) => (
    <a href={href} className={className} onClick={onClick} {...rest}>{children}</a>
  ),
  usePathname: vi.fn(() => mockPathname.value),
}))

import { BottomNav } from '@/components/layout/BottomNav'
import { NavLinks } from '@/components/layout/NavLinks'

function hrefsOf(container: HTMLElement): string[] {
  return within(container).getAllByRole('link').map((a) => a.getAttribute('href') ?? '')
}

describe('BottomNav', () => {
  const scrollTo = vi.fn()
  beforeEach(() => {
    mockPathname.value = '/home'
    scrollTo.mockReset()
    vi.stubGlobal('scrollTo', scrollTo)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tiene exactamente los mismos 5 destinos y en el mismo orden que NavLinks', () => {
    const { container: bottom } = render(<BottomNav username="ana" />)
    const bottomHrefs = hrefsOf(bottom)
    const { container: top } = render(<NavLinks username="ana" />)
    expect(bottomHrefs).toEqual(['/home', '/discover', '/library', '/lists', '/profile/ana'])
    expect(hrefsOf(top)).toEqual(bottomHrefs)
  })

  it('es una navegación con nombre y sin botón «Más»', () => {
    render(<BottomNav username="ana" />)
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('el activo lleva aria-current="page"', () => {
    render(<BottomNav username="ana" />)
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Descubrir' })).not.toHaveAttribute('aria-current')
  })

  // Regresión (V10): con `pathname === href` en /lists/abc no se marcaba nada.
  it('en una subpágina (/lists/abc) la pestaña Listas sigue activa', () => {
    mockPathname.value = '/lists/abc'
    render(<BottomNav username="ana" />)
    expect(screen.getByRole('link', { name: 'Listas' })).toHaveAttribute('aria-current', 'page')
  })

  it('etiquetas de 11 px (antes 10 px)', () => {
    render(<BottomNav username="ana" />)
    expect(screen.getByText('Inicio').className).toContain('text-[11px]')
  })

  it('re-tocar la pestaña en la que estás sube al principio y no navega', () => {
    render(<BottomNav username="ana" />)
    const link = screen.getByRole('link', { name: 'Inicio' })
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
  })

  it('desde una subpágina, tocar la pestaña vuelve a su raíz (navega)', () => {
    mockPathname.value = '/lists/abc'
    render(<BottomNav username="ana" />)
    const link = screen.getByRole('link', { name: 'Listas' })
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('tocar otra pestaña navega con normalidad', () => {
    render(<BottomNav username="ana" />)
    fireEvent.click(screen.getByRole('link', { name: 'Descubrir' }))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('respeta la zona segura inferior', () => {
    render(<BottomNav username="ana" />)
    const nav = screen.getByRole('navigation')
    expect(nav.className).toContain('pb-[env(safe-area-inset-bottom)]')
    expect(nav.className).toContain('md:hidden')
  })
})
