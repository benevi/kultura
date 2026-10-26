// ============================================================
// F-28 — El Calendario en el menú del avatar (único acceso en móvil y en
// escritorio estrecho), con su rótulo de `calendar.nav` y estado activo.
// ============================================================

import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn((ns: string) => (key: string, values?: Record<string, unknown>) =>
    ns === 'calendar.nav' ? `Calendario` : key === 'accountMenu' ? `Cuenta de ${values?.username}` : key
  ),
  useLocale: () => 'es',
}))
const mockPathname = vi.hoisted(() => ({ value: '/home' }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: vi.fn(() => mockPathname.value),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }))

import { AvatarDropdown } from '@/components/layout/AvatarDropdown'

describe('AvatarDropdown › Calendario', () => {
  beforeEach(() => {
    mockPathname.value = '/home'
  })

  it('primer enlace del menú, con su rótulo', () => {
    render(<AvatarDropdown username="ana" avatarColor="blue" avatarInitials="AN" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta de ana' }))
    const nav = screen.getByRole('navigation', { name: 'accountNav' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Calendario', '/calendar'],
      ['settings', '/settings'],
      ['suggestions', '/suggestions'],
    ])
  })

  it('en /calendar se marca la página actual', () => {
    mockPathname.value = '/calendar'
    render(<AvatarDropdown username="ana" avatarColor="blue" avatarInitials="AN" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta de ana' }))
    expect(screen.getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page')
  })
})
