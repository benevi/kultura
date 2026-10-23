// ============================================================
// KULTURA — Menús de la cabecera: centro «Social» y menú del avatar
// (DIS-9, ACC-10: disclosure con Esc y devolución del foco).
// ============================================================

import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const msg = (key: string, values?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    chat: 'Mensajes',
    friends: 'Amigos',
    groups: 'Grupos',
    social: 'Social',
    settings: 'Ajustes',
    suggestions: 'Sugerencias',
    language: 'Idioma',
    accountNav: 'Cuenta',
    signOut: 'Cerrar sesión',
  }
  if (key === 'socialLabel') return `Social (${values?.count})`
  if (key === 'unreadMessages') return `${values?.count} sin leer`
  if (key === 'accountMenu') return `Cuenta de ${values?.username}`
  return map[key] ?? key
}

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => msg),
  useLocale: () => 'es',
}))

const mockPathname = vi.hoisted(() => ({ value: '/home' }))
const mockPush = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, onClick, ...rest }: { href: string; children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <a href={href} className={className} onClick={onClick} {...rest}>{children}</a>
  ),
  usePathname: vi.fn(() => mockPathname.value),
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), replace: vi.fn() }),
}))

const unreadState = vi.hoisted(() => ({ count: 0 }))
vi.mock('@/components/layout/UnreadChatProvider', () => ({
  useUnreadChat: () => ({ unreadCount: unreadState.count, refreshUnread: vi.fn(), markConversationRead: vi.fn() }),
}))

const signOut = vi.fn(async () => ({}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut } }) }))

import { SocialMenu } from '@/components/layout/SocialMenu'
import { AvatarDropdown } from '@/components/layout/AvatarDropdown'

describe('SocialMenu', () => {
  beforeEach(() => {
    mockPathname.value = '/home'
    unreadState.count = 0
  })

  it('es un botón disclosure (aria-expanded/aria-controls) sin role="menu"', () => {
    render(<SocialMenu />)
    const btn = screen.getByRole('button', { name: 'Social (0)' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(btn.getAttribute('aria-controls')!)
    expect(panel).not.toBeNull()
    expect(panel).not.toBeVisible()
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toBeVisible()
    expect(document.querySelector('[role="menu"], [role="menuitem"]')).toBeNull()
  })

  it('abre Mensajes, Amigos y Grupos', () => {
    render(<SocialMenu />)
    fireEvent.click(screen.getByRole('button'))
    const nav = screen.getByRole('navigation', { name: 'Social' })
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/chat', '/friends', '/groups'])
  })

  it('el número de mensajes sin leer va en el nombre del botón y en un contador visible', () => {
    unreadState.count = 3
    render(<SocialMenu />)
    const btn = screen.getByRole('button', { name: 'Social (3)' })
    expect(within(btn).getByText('3')).toBeInTheDocument()
  })

  it('con más de 99 el contador dice 99+', () => {
    unreadState.count = 120
    render(<SocialMenu />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  // MOV-7: «en /chat/123 la pestaña activa es Chat».
  it('en /chat/123 el botón Social se marca y «Mensajes» lleva aria-current', () => {
    mockPathname.value = '/chat/123'
    render(<SocialMenu />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('data-current', 'true')
    fireEvent.click(btn)
    expect(screen.getByRole('link', { name: /Mensajes/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Amigos' })).not.toHaveAttribute('aria-current')
  })

  it('Esc cierra y devuelve el foco al botón', () => {
    render(<SocialMenu />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    screen.getByRole('link', { name: 'Amigos' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(btn)
  })

  it('un clic fuera lo cierra', () => {
    render(<div><SocialMenu /><p>fuera</p></div>)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.pointerDown(screen.getByText('fuera'))
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('elegir un destino cierra el panel', () => {
    render(<SocialMenu />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(screen.getByRole('link', { name: 'Grupos' }))
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('el botón mide 44×44', () => {
    render(<SocialMenu />)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('w-11')
    expect(cls).toContain('h-11')
  })
})

describe('AvatarDropdown', () => {
  const props = { username: 'ana', avatarColor: 'blue', avatarInitials: 'AN' }

  beforeEach(() => {
    mockPathname.value = '/home'
  })

  it('patrón disclosure: sin role="menu" ni menuitem', () => {
    render(<AvatarDropdown {...props} />)
    const btn = screen.getByRole('button', { name: 'Cuenta de ana' })
    expect(btn).not.toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.click(btn)
    expect(document.querySelector('[role="menu"], [role="menuitem"]')).toBeNull()
  })

  it('lleva Ajustes, Sugerencias, idioma y cerrar sesión', () => {
    render(<AvatarDropdown {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta de ana' }))
    expect(screen.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Sugerencias' })).toHaveAttribute('href', '/suggestions')
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('Esc cierra y devuelve el foco al avatar', () => {
    render(<AvatarDropdown {...props} />)
    const btn = screen.getByRole('button', { name: 'Cuenta de ana' })
    fireEvent.click(btn)
    screen.getByRole('link', { name: 'Ajustes' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(btn)
  })

  it('salir del panel con Tab lo cierra', () => {
    render(<div><AvatarDropdown {...props} /><button type="button">después</button></div>)
    const btn = screen.getByRole('button', { name: 'Cuenta de ana' })
    fireEvent.click(btn)
    const signOutBtn = screen.getByRole('button', { name: 'Cerrar sesión' })
    fireEvent.blur(signOutBtn, { relatedTarget: screen.getByRole('button', { name: 'después' }) })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('el avatar mide 44×44', () => {
    render(<AvatarDropdown {...props} />)
    const btn = screen.getByRole('button', { name: 'Cuenta de ana' })
    expect((btn.firstElementChild as HTMLElement).className).toMatch(/w-11 h-11/)
  })

  it('cerrar sesión llama a signOut y lleva al login', async () => {
    render(<AvatarDropdown {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cuenta de ana' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    })
    expect(signOut).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/login')
  })
})
