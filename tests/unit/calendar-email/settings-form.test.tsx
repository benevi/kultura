// ============================================================
// F-28 — Ajustes: escala de notas (movida desde la Biblioteca) y correo
// semanal opt-in con el texto del consentimiento a la vista; la página solo
// los ofrece cuando están disponibles.
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactElement } from 'react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key,
  useLocale: () => 'es',
}))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  usePathname: () => '/es/settings',
}))
vi.mock('@/components/ui/ToastProvider', () => ({ useToastContext: () => ({ show: vi.fn(), dismiss: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }))
const saveRatingScale = vi.fn()
vi.mock('@/lib/library/actions', () => ({ saveRatingScale: (...a: unknown[]) => saveRatingScale(...a) }))

import { SettingsForm } from '@/app/[locale]/(app)/settings/SettingsForm'
import { WEEKLY_EMAIL_CONSENT_VERSION } from '@/lib/email/consent'

const PROPS = {
  initialUsername: 'ana',
  initialAvatarColor: 'blue',
  initialAvatarIcon: null,
  initialLocale: 'es',
  userEmail: 'ana@example.com',
}

describe('Ajustes › escala de notas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sin RATING_SCALE_10 (prop null) no aparece', () => {
    render(<SettingsForm {...PROPS} />)
    expect(screen.queryByRole('radiogroup', { name: 'ratingScale' })).toBeNull()
  })

  it('se guarda al momento con la misma preferencia de F-24 y avisa', async () => {
    saveRatingScale.mockResolvedValue(undefined)
    render(<SettingsForm {...PROPS} initialRatingScale="stars" />)
    const group = screen.getByRole('radiogroup', { name: 'ratingScale' })
    fireEvent.click(within(group).getByRole('radio', { name: 'ratingScaleTen' }))
    await waitFor(() => expect(saveRatingScale).toHaveBeenCalledWith('ten'))
    expect(await screen.findByText('ratingScaleSaved')).toHaveAttribute('role', 'status')
    expect(refresh).toHaveBeenCalled()
  })

  it('si falla, vuelve atrás y lo dice (role=alert)', async () => {
    saveRatingScale.mockRejectedValue(new Error('x'))
    render(<SettingsForm {...PROPS} initialRatingScale="stars" />)
    const ten = within(screen.getByRole('radiogroup', { name: 'ratingScale' })).getByRole('radio', { name: 'ratingScaleTen' })
    fireEvent.click(ten)
    expect(await screen.findByRole('alert')).toHaveTextContent('ratingScaleError')
    expect(ten).toHaveAttribute('aria-checked', 'false')
  })
})

describe('Ajustes › correo semanal', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it('no disponible (prop null): no aparece', () => {
    render(<SettingsForm {...PROPS} />)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('opt-in: apagado por defecto, con el texto del consentimiento como descripción', () => {
    render(<SettingsForm {...PROPS} initialWeeklyEmail={{ weekly: false, consentedAt: null }} />)
    const sw = screen.getByRole('switch', { name: 'weeklyEmail' })
    expect(sw).not.toBeChecked()
    expect(sw).toHaveAccessibleDescription('weeklyEmailConsent')
    expect(document.getElementById('email')).not.toBeNull() // ancla de los enlaces del correo
  })

  it('doble opt-in: activar manda la versión, pide la confirmación por correo y el interruptor sigue apagado', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ weekly: false, pending: true }), { status: 202 }))
    render(<SettingsForm {...PROPS} initialWeeklyEmail={{ weekly: false, consentedAt: null }} />)
    expect(screen.getByText('weeklyEmailHowTo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/email/preferences')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ weekly: true, consentVersion: WEEKLY_EMAIL_CONSENT_VERSION, locale: 'es' })
    expect(await screen.findByText('weeklyEmailPending')).toHaveAttribute('role', 'status')
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('con la confirmación ya pedida (al volver a Ajustes) lo recuerda', () => {
    render(<SettingsForm {...PROPS} initialWeeklyEmail={{ weekly: false, consentedAt: null, pending: true }} />)
    expect(screen.getByText('weeklyEmailPending')).toBeInTheDocument()
  })

  it.each([
    [429, 'cooldown', 'weeklyEmailCooldown', 'status'],
    [429, 'daily_limit', 'weeklyEmailDailyLimit', 'status'],
    [503, 'busy', 'weeklyEmailBusy', 'status'],
    [403, 'unconfirmed_email', 'weeklyEmailUnconfirmed', 'alert'],
    [502, 'send_failed', 'weeklyEmailSendFailed', 'alert'],
  ])('%s %s → %s', async (status, error, text, role) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error }), { status }))
    render(<SettingsForm {...PROPS} initialWeeklyEmail={{ weekly: false, consentedAt: null }} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(await screen.findByText(text)).toHaveAttribute('role', role)
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('activo: desde cuándo y enlace al calendario', () => {
    render(<SettingsForm {...PROPS} initialWeeklyEmail={{ weekly: true, consentedAt: '2026-12-14T06:00:00Z' }} />)
    expect(screen.getByRole('switch')).toBeChecked()
    expect(screen.getByText(/weeklyEmailSince/)).toBeInTheDocument()
    expect(screen.queryByText('weeklyEmailHowTo')).toBeNull()
  })

  it('texto viejo (409): vuelve atrás y pide recargar', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 409 }))
    render(<SettingsForm {...PROPS} initialWeeklyEmail={{ weekly: false, consentedAt: null }} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(await screen.findByRole('alert')).toHaveTextContent('weeklyEmailStale')
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it('desactivar', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ weekly: false, consentedAt: '2026-12-01T00:00:00Z' }), { status: 200 }))
    render(<SettingsForm {...PROPS} initialWeeklyEmail={{ weekly: true, consentedAt: '2026-12-01T00:00:00Z' }} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(await screen.findByText('weeklyEmailOff')).toBeInTheDocument()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).weekly).toBe(false)
  })
})

// ── La página decide qué se ofrece ─────────────────────────────────────────

import { fakeSupabase, type FakeClient } from '../plataformas-listas/fake-supabase'

let client: FakeClient
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }))
vi.mock('@/app/api/settings/account-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/api/settings/account-state')>()),
  readAccountState: async () => ({ state: null, migrated: false }),
}))

describe('Ajustes › página', () => {
  const ENV = { WEEKLY_EMAIL: '1', RESEND_API_KEY: 're', EMAIL_FROM: 'K <a@b.c>', EMAIL_TOKEN_SECRET: 'z'.repeat(40) }
  afterEach(() => {
    for (const k of [...Object.keys(ENV), 'RATING_SCALE_10']) delete process.env[k]
  })

  async function formProps(
    prefs: { data: unknown; error: { code: string } | null },
    email = 'ana@example.com',
    confirmedAt: string | null = '2026-12-01T00:00:00Z'
  ) {
    client = fakeSupabase({
      tables: {
        users: [{ data: { id: 'u1', username: 'ana' }, error: null }],
        user_streaming_services: [{ data: null, error: { code: 'PGRST205' } }],
        email_preferences: [prefs],
      },
    })
    ;(client.auth as { getUser: () => Promise<unknown> }).getUser = async () => ({
      data: { user: { id: 'u1', email, email_confirmed_at: confirmedAt, app_metadata: {}, user_metadata: { rating_scale: 'ten' } } },
      error: null,
    })
    const { default: Page } = await import('@/app/[locale]/(app)/settings/page')
    const main = (await Page({ params: Promise.resolve({ locale: 'es' }) })) as ReactElement<{
      children: ReactElement<{ initialRatingScale: unknown; initialWeeklyEmail: unknown }>
    }>
    return main.props.children.props
  }

  it('sin banderas: ni escala ni correo (y no se lee email_preferences)', async () => {
    const props = await formProps({ data: { weekly_digest: true }, error: null })
    expect(props.initialRatingScale).toBeNull()
    expect(props.initialWeeklyEmail).toBeNull()
    expect(client.calls.some((c) => c.table === 'email_preferences')).toBe(false)
  })

  it('con RATING_SCALE_10: la escala guardada de la persona', async () => {
    process.env.RATING_SCALE_10 = '1'
    expect((await formProps({ data: null, error: null })).initialRatingScale).toBe('ten')
  })

  it('con el correo configurado: su preferencia; sin la migración, nada', async () => {
    Object.assign(process.env, ENV)
    expect((await formProps({ data: { weekly_digest: true, consent_version: 'v', consented_at: '2026-12-01' }, error: null })).initialWeeklyEmail).toEqual({
      weekly: true,
      consentedAt: '2026-12-01',
      pending: false,
    })
    expect((await formProps({ data: null, error: null })).initialWeeklyEmail).toEqual({ weekly: false, consentedAt: null, pending: false })
    const recent = new Date(Date.now() - 3600_000).toISOString()
    expect((await formProps({ data: { weekly_digest: false, optin_requested_at: recent }, error: null })).initialWeeklyEmail).toMatchObject({ pending: true })
    expect((await formProps({ data: null, error: { code: 'PGRST205' } })).initialWeeklyEmail).toBeNull()
  })

  it('dirección sin confirmar: la opción no se ofrece', async () => {
    Object.assign(process.env, ENV)
    expect((await formProps({ data: null, error: null }, 'ana@example.com', null)).initialWeeklyEmail).toBeNull()
  })
})
