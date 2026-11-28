// ============================================================
// KULTURA — HTML de la cabecera con sesión y de la pública (caracterización,
// fase 8.5 M2).
//
// Fija lo que pintan hoy `AuthHeader` y `Header` para que la bandera
// `SALA_MARCA` apagada los deje EXACTAMENTE igual. La instantánea se sacó
// antes de tocarlos: si cambia con la bandera apagada, algo de «Sala» se ha
// colado.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
vi.mock('@/components/layout/UnreadChatProvider', () => ({ useUnreadChat: () => ({ unreadCount: 2 }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }))

import { AuthHeader } from '@/components/layout/AuthHeader'
import { Header } from '@/components/layout/Header'

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

describe('armazón de hoy (SALA_MARCA apagada)', () => {
  it('cabecera con sesión, en Biblioteca y con 3 avisos sin leer', () => {
    const html = renderToStaticMarkup(withIntl(<AuthHeader profile={profile} unreadCount={3} />))
    expect(html).toMatchSnapshot()
  })

  it('cabecera pública', async () => {
    const html = renderToStaticMarkup(withIntl(await Header({ locale: 'es' })))
    expect(html).toMatchSnapshot()
  })
})
