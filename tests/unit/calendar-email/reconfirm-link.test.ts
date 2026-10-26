// ============================================================
// F-28 — Regresión (revisión #49): el enlace de reconfirmación que manda el
// envío semanal (dirección cambiada) se firmaba con la hora de INICIO del
// cron, anterior a la baja de `email_reconfirm_required`, y la base lo daba
// siempre por `superseded` (reproducido en PostgreSQL 16; el caso SQL está en
// tests/integration/email/local-pg-cases.sql). Ahora se firma tras la reserva.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sent = vi.hoisted(() => [] as Array<{ text: string }>)
vi.mock('@/lib/email/resend', async (orig) => ({
  ...(await orig<typeof import('@/lib/email/resend')>()),
  sendEmail: vi.fn(async (m: { text: string }) => {
    sent.push(m)
    return { ok: true, id: 're_1' }
  }),
}))

import { defaultDigestDeps } from '@/lib/email/digest'
import { OPTIN_TOKEN_TTL_SECONDS, verifyOptinToken } from '@/lib/email/unsubscribe-token'

const SECRET = 'r'.repeat(40)
const ENV = { WEEKLY_EMAIL: '1', RESEND_API_KEY: 're', EMAIL_FROM: 'K <a@b.c>', EMAIL_TOKEN_SECRET: SECRET }
const U1 = '11111111-1111-4111-8111-111111111111'

describe('enlace de reconfirmación del envío semanal', () => {
  beforeEach(() => {
    sent.length = 0
    Object.assign(process.env, ENV)
  })
  afterEach(() => {
    for (const k of Object.keys(ENV)) delete process.env[k]
  })

  it('se firma con la hora de después de la reserva, no con la de inicio del cron', async () => {
    let claimedAt = 0
    const admin = {
      rpc: async (fn: string) => {
        if (fn !== 'email_optin_claim') throw new Error(fn)
        claimedAt = Date.now()
        return { data: 'ok', error: null }
      },
    }
    const cronStart = new Date(Date.now() - 3600_000)
    const deps = defaultDigestDeps(admin as never, cronStart)
    expect(await deps.requestOptin!({ userId: U1, email: 'nueva@example.com', username: 'ana', locale: 'es' })).toBe('sent')

    const link = /https:\/\/\S+\/es\/email\/confirm\?t=\S+/.exec(sent[0].text)?.[0]
    const check = verifyOptinToken(new URL(link!).searchParams.get('t'), SECRET)
    expect(check.ok).toBe(true)
    if (!check.ok) return
    const issuedAt = check.expiresAt.getTime() - OPTIN_TOKEN_TTL_SECONDS * 1000
    // Precisión de segundos (caducidad Unix): nunca antes del segundo de la reserva.
    expect(issuedAt).toBeGreaterThanOrEqual(Math.floor(claimedAt / 1000) * 1000)
    expect(issuedAt).toBeGreaterThan(cronStart.getTime())
  })

  it('la base compara baja y emisión con la misma precisión (segundos)', async () => {
    const { readFileSync } = await import('node:fs')
    const path = await import('node:path')
    const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261215280001_calendar_email.sql'), 'utf8')
    expect(sql).toContain("date_trunc('second', v_row.unsubscribed_at) > date_trunc('second', p_issued_at)")
    expect(sql).not.toMatch(/v_row\.unsubscribed_at > p_issued_at/)
  })
})
