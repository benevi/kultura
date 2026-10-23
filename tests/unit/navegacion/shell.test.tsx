// ============================================================
// KULTURA — Envoltorio de la app con sesión, pies, ErrorState e idioma
// (MOV-6, V8, ROJO-11, DIS-13, MOV-4, ACC-12).
// ============================================================

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks comunes ─────────────────────────────────────────────────────────────
const tr = (ns: string) => (key: string) => {
  const maps: Record<string, Record<string, string>> = {
    errors: { somethingWentWrong: 'Algo salió mal', tryAgain: 'Inténtalo de nuevo', goHome: 'Ir al inicio' },
    nav: { oops: '¡Ups!', language: 'Idioma', suggestions: 'Sugerencias', footerNav: 'Información' },
    legal: { footerPrivacy: 'Privacidad', footerTerms: 'Términos' },
  }
  return maps[ns]?.[key] ?? key
}

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => tr(ns),
  useLocale: () => 'es',
}))
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'es',
  getTranslations: async (ns: string) =>
    Object.assign(tr(ns), {
      rich: (_k: string, tags: Record<string, (c: string) => React.ReactNode>) => [tags.tmdb('TMDB'), tags.rawg('RAWG')],
    }),
}))

const mockReplace = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, ...rest }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className} {...rest}>{children}</a>
  ),
  usePathname: () => '/library',
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn() }),
}))

// ── Layout ───────────────────────────────────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'ana@x.es' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'u1', username: 'ana', avatar_color: 'blue', avatar_initials: 'AN' } }) }) }),
    }),
  }),
}))
vi.mock('next/headers', () => ({ headers: () => ({ get: () => null }) }))
vi.mock('next/navigation', () => ({
  redirect: (u: string) => { throw new Error(`redirect ${u}`) },
  useParams: () => ({ locale: 'es' }),
}))
vi.mock('@/lib/social/notifications', () => ({ getUnreadCount: async () => 0 }))
vi.mock('@/components/layout/AuthHeader', () => ({ AuthHeader: () => <header data-testid="auth-header" /> }))
vi.mock('@/components/layout/BottomNav', () => ({
  BottomNav: ({ username }: { username: string }) => <nav data-testid="bottom-nav" data-username={username} />,
}))
vi.mock('@/components/layout/AppFooter', () => ({ AppFooter: () => <footer data-testid="app-footer" /> }))
vi.mock('@/components/ui/ToastProvider', () => ({ ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/layout/UnreadChatProvider', () => ({
  UnreadChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/layout/DemoBanner', () => ({ DemoBanner: () => null }))
vi.mock('@/lib/demo', () => ({ isDemoUser: () => false }))

import AppLayout from '@/app/[locale]/(app)/layout'
import { ErrorState } from '@/components/layout/ErrorState'
import { Footer } from '@/components/layout/Footer'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { renderDataAttribution } from '@/components/legal/DataAttribution'

describe('(app)/layout con sesión', () => {
  async function renderLayout() {
    const el = await AppLayout({ children: <main data-testid="page">pagina</main>, params: Promise.resolve({ locale: 'es' }) })
    return render(el)
  }

  // Regresión (V8): `pb-16` envolvía solo `{children}` y el pie quedaba bajo la BottomNav.
  it('el relleno inferior envuelve el contenido Y el pie, con zona segura', async () => {
    await renderLayout()
    const footer = screen.getByTestId('app-footer')
    const padded = footer.closest('[class*="pb-[calc(4rem+env(safe-area-inset-bottom))]"]')
    expect(padded).not.toBeNull()
    expect(padded).toContainElement(screen.getByTestId('page'))
    expect(padded!.className).toContain('md:pb-0')
  })

  it('usa min-h-dvh (no 100vh, que en móvil no descuenta la barra del navegador)', async () => {
    const { container } = await renderLayout()
    expect((container.firstElementChild as HTMLElement).className).toContain('min-h-dvh')
  })

  it('la BottomNav recibe el usuario para su pestaña Perfil', async () => {
    await renderLayout()
    expect(screen.getByTestId('bottom-nav')).toHaveAttribute('data-username', 'ana')
  })
})

describe('ErrorState (DIS-13)', () => {
  it('tiene dos acciones: Reintentar (primaria) e Ir al inicio', () => {
    const reset = vi.fn()
    render(<ErrorState reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Inténtalo de nuevo' }))
    expect(reset).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es/home')
  })

  it('el destino de «Ir al inicio» se puede cambiar (páginas públicas → /)', () => {
    render(<ErrorState reset={vi.fn()} homeHref="/" />)
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es')
  })

  it('el título es un encabezado que recibe el foco al aparecer', () => {
    render(<ErrorState reset={vi.fn()} />)
    const h = screen.getByRole('heading', { name: 'Algo salió mal' })
    expect(document.activeElement).toBe(h)
  })

  it('los dos botones miden 44 px de alto', () => {
    render(<ErrorState reset={vi.fn()} />)
    expect(screen.getByRole('button').className).toContain('h-11')
    expect(screen.getByRole('link').className).toContain('h-11')
  })

  it('la ilustración es decorativa', () => {
    render(<ErrorState reset={vi.fn()} />)
    expect(screen.getByText('¡Ups!').closest('[aria-hidden]')).not.toBeNull()
  })
})

describe('Pies y atribución (MOV-4, ACC-12, ROJO-11)', () => {
  it('Footer: enlaces en una nav con nombre y de 44 px de alto', async () => {
    render(await Footer())
    const nav = screen.getByRole('navigation', { name: 'Información' })
    for (const a of within(nav).getAllByRole('link')) expect(a.className).toContain('min-h-11')
  })

  it('atribución: TMDB y RAWG enlazados, con zona táctil ampliada', async () => {
    render(await renderDataAttribution())
    for (const name of ['TMDB', 'RAWG']) {
      const a = screen.getByRole('link', { name })
      expect(a.className).toMatch(/py-4/)
      expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})

describe('LanguageSwitcher', () => {
  beforeEach(() => mockReplace.mockReset())

  it('dos botones de 44×44 con aria-pressed y lang propio', () => {
    render(<LanguageSwitcher />)
    const group = screen.getByRole('group', { name: 'Idioma' })
    const [es, en] = within(group).getAllByRole('button')
    expect(es).toHaveAttribute('aria-pressed', 'true')
    expect(en).toHaveAttribute('aria-pressed', 'false')
    expect(en).toHaveAttribute('lang', 'en')
    expect(es.className).toContain('w-11')
    expect(es.className).toContain('h-11')
  })

  it('cambiar a inglés reemplaza la ruta con el otro locale', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(mockReplace).toHaveBeenCalledWith('/library', { locale: 'en' })
  })
})
