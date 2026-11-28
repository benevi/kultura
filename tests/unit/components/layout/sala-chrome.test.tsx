// ============================================================
// Fase 8.5 · M2 — cabeceras de «Sala» (bandera `SALA_MARCA`).
//   - con sesión: el logo D1 como enlace a Inicio con nombre «Kultura», los
//     destinos como enlaces de «Sala» con la página actual en `aria-current`,
//     y el contador de avisos en el nombre de la campana;
//   - la pública: solo con `SALA_MARCA=1` (sin cookies), con `<a>` y sin JS;
//   - los iconos de la página y los del manifest: los de «Sala» solo con `1`.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider, createTranslator } from 'next-intl'
import type { ReactNode } from 'react'
import es from '../../../../messages/es.json'

const h = vi.hoisted(() => ({ pathname: '/library' }))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => h.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'es'),
  getTranslations: vi.fn(async (opts: { namespace?: string } | string) =>
    createTranslator({ locale: 'es', messages: es, namespace: (typeof opts === 'string' ? opts : opts?.namespace) as 'auth' }),
  ),
}))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/components/layout/UnreadChatProvider', () => ({ useUnreadChat: () => ({ unreadCount: 0 }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }))

import { SalaAuthHeader } from '@/components/layout/sala/SalaAuthHeader'
import { Header } from '@/components/layout/Header'
import { shellMetadata, SALA_ICONS } from '@/i18n/metadata'
import { salaMarcaForAll } from '@/lib/flags/sala'
import manifest from '@/app/manifest'
import fs from 'node:fs'
import path from 'node:path'

const profile = { username: 'ana', avatar_color: '#c46a3a', avatar_initials: 'AN', avatar_icon: null }

const withIntl = (node: ReactNode) => (
  <NextIntlClientProvider locale="es" messages={es} timeZone="Europe/Madrid">
    {node}
  </NextIntlClientProvider>
)

const ENV = process.env.SALA_MARCA
beforeEach(() => {
  h.pathname = '/library'
  delete process.env.SALA_MARCA
})
afterEach(() => {
  if (ENV === undefined) delete process.env.SALA_MARCA
  else process.env.SALA_MARCA = ENV
})

describe('cabecera con sesión en «Sala»', () => {
  it('el logo lleva a Inicio y se llama «Kultura»', () => {
    render(withIntl(<SalaAuthHeader profile={profile} unreadCount={0} />))
    const logo = screen.getByRole('link', { name: 'Kultura' })
    expect(logo).toHaveAttribute('href', '/es/home')
    expect(within(logo).getByRole('img', { name: 'Kultura' })).toHaveAttribute('data-sala-logo')
  })

  it('marca solo la página actual con aria-current, también dentro de una sección', () => {
    h.pathname = '/lists/abc'
    render(withIntl(<SalaAuthHeader profile={profile} unreadCount={0} />))
    const nav = screen.getByRole('navigation', { name: es.nav.primaryNav })
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.textContent)).toEqual([es.nav.lists])
    expect(within(nav).getAllByRole('link')).toHaveLength(6)
  })

  it('el contador de avisos va en el nombre de la campana y se ve', () => {
    render(withIntl(<SalaAuthHeader profile={profile} unreadCount={3} />))
    const bell = screen.getByRole('link', { name: createTranslator({ locale: 'es', messages: es, namespace: 'nav' })('notificationsLabel', { count: 3 }) })
    expect(bell).toHaveTextContent('3')
  })

  it('sin las cajas ni el contador de la cabecera de hoy (los paneles, cerrados, siguen igual)', () => {
    const html = renderToStaticMarkup(withIntl(<SalaAuthHeader profile={profile} unreadCount={3} />))
    expect(html).not.toMatch(/bg-surface-elevated|accent-pink|rounded-full/)
  })
})

describe('cabecera pública', () => {
  it('con SALA_MARCA=1, la de «Sala»: enlaces del servidor a entrar y registrarse', async () => {
    process.env.SALA_MARCA = '1'
    render(withIntl(await Header({ locale: 'es' })))
    expect(document.querySelector('[data-sala-header]')).not.toBeNull()
    expect(screen.getByRole('link', { name: es.auth.signIn })).toHaveAttribute('href', '/es/login?mode=login')
    expect(screen.getByRole('link', { name: es.auth.signUp })).toHaveAttribute('href', '/es/login?mode=register')
    expect(screen.getAllByRole('img', { name: 'Kultura' }).length).toBeGreaterThan(0)
  })

  it.each([undefined, '0', 'prueba'])('con SALA_MARCA=%s, la de hoy', async (value) => {
    if (value !== undefined) process.env.SALA_MARCA = value
    render(withIntl(await Header({ locale: 'es' })))
    expect(document.querySelector('[data-sala-header]')).toBeNull()
  })
})

describe('iconos de la página', () => {
  it('los de «Sala» solo con SALA_MARCA=1', async () => {
    process.env.SALA_MARCA = '1'
    expect(salaMarcaForAll()).toBe(true)
    expect((await shellMetadata('es')).icons).toEqual(SALA_ICONS)
    process.env.SALA_MARCA = 'prueba'
    expect(salaMarcaForAll()).toBe(false)
    expect((await shellMetadata('es')).icons).toBeUndefined()
  })
})

describe('manifest de la PWA', () => {
  const srcs = () => {
    const m = manifest()
    return [...(m.icons ?? []), ...(m.shortcuts ?? []).flatMap((sc) => sc.icons ?? [])].map((i) => i.src)
  }

  it.each([undefined, '0', 'prueba'])('con SALA_MARCA=%s, los iconos de hoy', (value) => {
    if (value !== undefined) process.env.SALA_MARCA = value
    expect(srcs().every((src) => src.startsWith('/icons/') && !src.startsWith('/icons/sala/'))).toBe(true)
  })

  it('con SALA_MARCA=1, los de «Sala», y existen', () => {
    process.env.SALA_MARCA = '1'
    const list = srcs()
    expect(list.every((src) => src.startsWith('/icons/sala/'))).toBe(true)
    for (const src of list) expect(fs.existsSync(path.join(process.cwd(), 'public', src)), src).toBe(true)
  })
})
