// ============================================================
// F-28 — Páginas: /calendar (con sesión, filtro por formato, avisos de
// calendario parcial, vuelta desde el correo) y /email/unsubscribe (sin
// sesión: abrirla no da de baja; el botón hace POST). Menú del avatar con el
// Calendario.
// ============================================================

import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactElement } from 'react'
import type { CalendarEvent, CalendarResult } from '@/lib/calendar/types'

const h = vi.hoisted(() => ({
  user: { id: 'u1', email: 'ana@example.com', app_metadata: {} } as { id: string; email: string; app_metadata: Record<string, unknown> } | null,
  calendar: vi.fn(),
  after: vi.fn(),
  markReturn: vi.fn(),
  pref: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getTranslations: async (ns: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns}.${key}${values ? `(${Object.values(values).join(',')})` : ''}`,
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`redirect:${to}`) }) }))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: h.after }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user }, error: null }) } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/calendar/data', () => ({ getUserCalendar: h.calendar }))
vi.mock('@/lib/email/preferences', () => ({ readWeeklyEmailPreference: h.pref }))
vi.mock('@/lib/email/digest', async (orig) => ({
  ...(await orig<typeof import('@/lib/email/digest')>()),
  markWeeklyReturn: h.markReturn,
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/calendar',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => <span data-testid="poster" /> }))
vi.mock('@/components/layout/Header', () => ({ Header: () => <header /> }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => <footer /> }))

import CalendarPage from '@/app/[locale]/(app)/calendar/page'
import UnsubscribePage from '@/app/[locale]/email/unsubscribe/page'
import { createUnsubscribeToken } from '@/lib/email/unsubscribe-token'

const TODAY = '2026-12-14'
function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: `${over.mediaId ?? 'tv_1'}:${over.kind ?? 'episode'}:${over.date}`,
    mediaId: 'tv_1',
    type: 'tv',
    title: 'Serie',
    poster: 'https://image.tmdb.org/t/p/w342/a.jpg',
    status: 'in_progress',
    kind: 'episode',
    date: TODAY,
    precision: 'day',
    season: 1,
    episode: 2,
    ...over,
  }
}
const RESULT: CalendarResult = {
  events: [
    ev({ mediaId: 'tv_1', title: 'The Last of Us', date: TODAY }),
    ev({ mediaId: 'movie_9', type: 'movie', kind: 'theatrical', region: 'ES', title: 'Vengadores', date: '2026-12-18', status: 'pending' }),
    ev({ mediaId: 'game_7', type: 'game', kind: 'release', title: 'Juego', date: null, precision: 'tba', status: 'pending' }),
    ev({ mediaId: 'manga_x', type: 'manga', kind: 'chapter', chapter: '1170', title: 'One Piece', date: '2026-12-12' }),
  ],
  candidates: 4,
  checked: 4,
  failed: 0,
  today: TODAY,
}

async function renderCalendar(query: Record<string, string> = {}) {
  const page = (await CalendarPage({ params: Promise.resolve({ locale: 'es' }), searchParams: Promise.resolve(query) })) as ReactElement
  return render(page)
}

describe('/calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.user = { id: 'u1', email: 'ana@example.com', app_metadata: {} }
    h.calendar.mockResolvedValue(RESULT)
    h.pref.mockResolvedValue(null)
  })
  afterEach(() => {
    for (const k of ['WEEKLY_EMAIL', 'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_TOKEN_SECRET']) delete process.env[k]
  })

  it('sin sesión: al login con vuelta', async () => {
    h.user = null
    await expect(CalendarPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) })).rejects.toThrow(
      'redirect:/en/login?next=%2Fen%2Fcalendar'
    )
  })

  it('agenda: próximos días, recién salido y más adelante, con enlace a cada ficha', async () => {
    await renderCalendar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('calendar.title')
    const upcoming = screen.getByRole('region', { name: 'calendar.upcoming' })
    expect(within(upcoming).getAllByRole('heading', { level: 3 }).map((x) => x.textContent)).toEqual([
      'calendar.today',
      expect.stringMatching(/viernes, 18 de diciembre/),
    ])
    expect(within(upcoming).getByRole('link', { name: 'The Last of Us' })).toHaveAttribute('href', '/media/tv/1')
    expect(within(upcoming).getByText('calendar.theatrical(España)')).toBeInTheDocument()
    expect(within(upcoming).getByText('calendar.today').closest('time')).toHaveAttribute('dateTime', TODAY)
    const recent = screen.getByRole('region', { name: 'calendar.recent' })
    expect(within(recent).getByText('calendar.chapterOut(1170)')).toBeInTheDocument()
    const later = screen.getByRole('region', { name: 'calendar.later' })
    expect(within(later).getByText('calendar.tba')).toBeInTheDocument()
    // Portada siempre con el gradiente detrás.
    expect(screen.getAllByTestId('poster')).toHaveLength(4)
  })

  it('filtro por formato con enlaces (sin JS) y estado actual', async () => {
    await renderCalendar({ type: 'movie' })
    const nav = screen.getByRole('navigation', { name: 'calendar.filterLabel' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/calendar',
      '/calendar?type=tv',
      '/calendar?type=anime',
      '/calendar?type=movie',
      '/calendar?type=game',
      '/calendar?type=manga',
    ])
    expect(within(nav).getByRole('link', { name: 'discoverFilters.typeBadge.movie' })).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByText('The Last of Us')).toBeNull()
    expect(screen.getByText('Vengadores')).toBeInTheDocument()
  })

  it('calendario parcial o recortado: lo dice', async () => {
    h.calendar.mockResolvedValue({ ...RESULT, failed: 1, candidates: 60, checked: 40 })
    await renderCalendar()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('calendar.partial')
    expect(status).toHaveTextContent('calendar.truncated(40,60)')
  })

  it('biblioteca sin nada en curso ni pendiente: estado vacío que lleva a Descubrir', async () => {
    h.calendar.mockResolvedValue({ events: [], candidates: 0, checked: 0, failed: 0, today: TODAY })
    await renderCalendar()
    expect(screen.getByRole('heading', { name: 'calendar.emptyLibraryTitle' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'calendar.emptyLibraryCta' })).toHaveAttribute('href', '/discover')
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('vuelta desde el correo de la semana: se mide (después de responder)', async () => {
    await renderCalendar({ utm_source: 'email', utm_medium: 'email', utm_campaign: 'weekly-2026-W51' })
    expect(h.after).toHaveBeenCalledTimes(1)
    await h.after.mock.calls[0][0]()
    expect(h.markReturn).toHaveBeenCalledWith({}, 'u1', '2026-W51')
    vi.clearAllMocks()
    h.calendar.mockResolvedValue(RESULT)
    await renderCalendar({ utm_source: 'x', utm_campaign: 'weekly-2026-W51' })
    expect(h.after).not.toHaveBeenCalled()
  })

  it('con el correo disponible y sin activar: invitación a Ajustes', async () => {
    Object.assign(process.env, { WEEKLY_EMAIL: '1', RESEND_API_KEY: 're', EMAIL_FROM: 'K <a@b.c>', EMAIL_TOKEN_SECRET: 'z'.repeat(40) })
    h.pref.mockResolvedValue({ weekly: false, consentVersion: null, consentedAt: null })
    await renderCalendar()
    expect(screen.getByRole('link', { name: 'calendar.emailPromoCta' })).toHaveAttribute('href', '/settings#email')
    h.pref.mockResolvedValue({ weekly: true, consentVersion: 'v', consentedAt: 'x' })
    const { container } = await renderCalendar()
    expect(within(container).queryByRole('link', { name: 'calendar.emailPromoCta' })).toBeNull()
  })

  it('si el calendario falla del todo, mensaje (no pantalla de error)', async () => {
    h.calendar.mockRejectedValue(new Error('down'))
    await renderCalendar()
    expect(screen.getByText('calendar.partial')).toBeInTheDocument()
  })
})

describe('/email/unsubscribe', () => {
  const SECRET = 'q'.repeat(40)
  beforeEach(() => {
    process.env.EMAIL_TOKEN_SECRET = SECRET
  })
  afterEach(() => {
    delete process.env.EMAIL_TOKEN_SECRET
  })

  async function renderPage(query: Record<string, string>, locale = 'es') {
    const page = (await UnsubscribePage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) })) as ReactElement
    return render(page)
  }

  it('con enlace válido: pide confirmar con un POST (abrirla no da de baja)', async () => {
    const t = createUnsubscribeToken('11111111-1111-4111-8111-111111111111', SECRET)
    const { container } = await renderPage({ t }, 'en')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('email.unsubscribe.title')
    const form = container.querySelector('form')!
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/api/email/unsubscribe')
    expect((form.querySelector('input[name="t"]') as HTMLInputElement).value).toBe(t)
    expect((form.querySelector('input[name="l"]') as HTMLInputElement).value).toBe('en')
    expect(screen.getByRole('button', { name: 'email.unsubscribe.confirm' })).toBeInTheDocument()
  })

  it('hecho', async () => {
    await renderPage({ status: 'done' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('email.unsubscribe.doneTitle')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('enlace falso o caducado: lo dice y ofrece Ajustes', async () => {
    await renderPage({ t: 'v1.Zm9v.YmFy' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('email.unsubscribe.invalidTitle')
    expect(screen.getByRole('link', { name: 'email.unsubscribe.settings' })).toHaveAttribute('href', '/es/settings#email')
  })

  it('error: permite reintentar con el mismo enlace', async () => {
    await renderPage({ status: 'error', t: 'v1.a.b' })
    expect(screen.getByRole('button', { name: 'email.unsubscribe.retry' })).toBeInTheDocument()
  })

  it('no se indexa ni manda el token como referrer', async () => {
    const { generateMetadata } = await import('@/app/[locale]/email/unsubscribe/page')
    expect(await generateMetadata()).toMatchObject({ robots: { index: false, follow: false }, referrer: 'no-referrer' })
  })
})
