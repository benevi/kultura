// ============================================================
// F-28 — Enlace de baja firmado, versión del consentimiento y bandera del
// correo semanal.
// ============================================================

import { describe, it, expect } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import {
  UNSUBSCRIBE_TOKEN_TTL_SECONDS,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '@/lib/email/unsubscribe-token'
import { WEEKLY_EMAIL_CONSENT_SHA256, WEEKLY_EMAIL_CONSENT_VERSION, isCurrentConsentVersion } from '@/lib/email/consent'
import { weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'

const SECRET = 'x'.repeat(40)
const USER = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-12-14T06:00:00Z')

describe('token de baja', () => {
  it('ida y vuelta', () => {
    const token = createUnsubscribeToken(USER, SECRET, NOW)
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(token.length).toBeLessThan(200)
    const check = verifyUnsubscribeToken(token, SECRET, NOW)
    expect(check).toEqual({ ok: true, userId: USER, expiresAt: new Date(NOW.getTime() + UNSUBSCRIBE_TOKEN_TTL_SECONDS * 1000) })
  })

  it('caduca a los 90 días', () => {
    const token = createUnsubscribeToken(USER, SECRET, NOW)
    const later = new Date(NOW.getTime() + (UNSUBSCRIBE_TOKEN_TTL_SECONDS + 1) * 1000)
    expect(verifyUnsubscribeToken(token, SECRET, later)).toEqual({ ok: false, reason: 'expired' })
    expect(UNSUBSCRIBE_TOKEN_TTL_SECONDS).toBe(90 * 86400)
  })

  it('no enumerable: cambiar el id (o cualquier carácter) invalida la firma', () => {
    const token = createUnsubscribeToken(USER, SECRET, NOW)
    const [v, body, sig] = token.split('.')
    const other = Buffer.from(Buffer.from(body, 'base64url').toString().replace(USER, '22222222-2222-4222-8222-222222222222')).toString('base64url')
    expect(verifyUnsubscribeToken(`${v}.${other}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    expect(verifyUnsubscribeToken(`${v}.${body}.${flipped}`, SECRET, NOW).ok).toBe(false)
  })

  it('otro secreto no vale', () => {
    const token = createUnsubscribeToken(USER, SECRET, NOW)
    expect(verifyUnsubscribeToken(token, 'y'.repeat(40), NOW)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it.each([undefined, '', 'v2.a.b', 'v1.a', 'v1.a.b.c', 'v1.@@.##', 'v1.' + 'a'.repeat(300) + '.b', 42])(
    'basura → malformed (%s)',
    (token) => {
      expect(verifyUnsubscribeToken(token, SECRET, NOW)).toMatchObject({ ok: false })
    }
  )

  it('firma válida con otro propósito o forma → malformed', () => {
    // Si alguna vez se firmara otra cosa con el mismo secreto, no sirve para dar de baja.
    const body = `login:${USER}:${Math.floor(NOW.getTime() / 1000) + 100}`
    const sig = createHmac('sha256', SECRET).update(`v1.${body}`).digest().subarray(0, 16).toString('base64url')
    expect(verifyUnsubscribeToken(`v1.${Buffer.from(body).toString('base64url')}.${sig}`, SECRET, NOW)).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('solo para ids de usuario (uuid)', () => {
    expect(() => createUnsubscribeToken('ana', SECRET, NOW)).toThrow()
  })
})

describe('consentimiento', () => {
  it('la huella del texto aceptado coincide con la versión vigente (si cambias el texto, sube la versión)', () => {
    const sha = (s: string) => createHash('sha256').update(s).digest('hex')
    expect({
      es: sha((es as { settings: { weeklyEmailConsent: string } }).settings.weeklyEmailConsent),
      en: sha((en as { settings: { weeklyEmailConsent: string } }).settings.weeklyEmailConsent),
    }).toEqual(WEEKLY_EMAIL_CONSENT_SHA256)
  })

  it('la versión cumple el CHECK de la base', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261215280001_calendar_email.sql'), 'utf8')
    expect(sql).toContain("consent_version ~ '^[a-z0-9][a-z0-9.-]{0,31}$'")
    expect(WEEKLY_EMAIL_CONSENT_VERSION).toMatch(/^[a-z0-9][a-z0-9.-]{0,31}$/)
    expect(isCurrentConsentVersion(WEEKLY_EMAIL_CONSENT_VERSION)).toBe(true)
    expect(isCurrentConsentVersion('2020-01-v0')).toBe(false)
  })

  it('el texto dice qué, cada cuánto y cómo darse de baja (es/en)', () => {
    const textEs = (es as { settings: { weeklyEmailConsent: string } }).settings.weeklyEmailConsent
    const textEn = (en as { settings: { weeklyEmailConsent: string } }).settings.weeklyEmailConsent
    expect(textEs).toMatch(/lunes/)
    expect(textEs).toMatch(/baja/)
    expect(textEn).toMatch(/Monday/)
    expect(textEn).toMatch(/unsubscribe/)
  })
})

describe('bandera y variables', () => {
  const full = {
    WEEKLY_EMAIL: '1',
    RESEND_API_KEY: 're_x',
    EMAIL_FROM: 'KULTURA <onboarding@resend.dev>',
    EMAIL_TOKEN_SECRET: SECRET,
  } as unknown as NodeJS.ProcessEnv

  it.each([
    [{}, 'flag_off'],
    [{ ...full, WEEKLY_EMAIL: '0' }, 'flag_off'],
    [{ ...full, RESEND_API_KEY: ' ' }, 'missing_resend_key'],
    [{ ...full, EMAIL_FROM: '' }, 'missing_from'],
    [{ ...full, EMAIL_TOKEN_SECRET: 'corto' }, 'missing_token_secret'],
  ])('sin todo → desactivado (%#)', (env, reason) => {
    expect(weeklyEmailConfig(env as NodeJS.ProcessEnv)).toEqual({ enabled: false, reason })
  })

  it('con todo → activado para cualquiera', () => {
    const config = weeklyEmailConfig(full)
    expect(config).toMatchObject({ enabled: true, from: 'KULTURA <onboarding@resend.dev>', only: null })
    expect(weeklyEmailAllowedFor(config, 'cualquiera@example.com')).toBe(true)
    expect(weeklyEmailAllowedFor(config, null)).toBe(false)
  })

  it('WEEKLY_EMAIL_ONLY: solo esas direcciones (pruebas con onboarding@resend.dev)', () => {
    const config = weeklyEmailConfig({ ...full, WEEKLY_EMAIL_ONLY: ' Victor@Example.com , otra@x.es' } as NodeJS.ProcessEnv)
    expect(weeklyEmailAllowedFor(config, 'victor@example.com')).toBe(true)
    expect(weeklyEmailAllowedFor(config, 'otra@x.es')).toBe(true)
    expect(weeklyEmailAllowedFor(config, 'nadie@x.es')).toBe(false)
  })
})
