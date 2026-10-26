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
  OPTIN_TOKEN_TTL_SECONDS,
  UNSUBSCRIBE_TOKEN_TTL_SECONDS,
  createOptinToken,
  createUnsubscribeToken,
  emailFingerprint,
  verifyOptinToken,
  verifyUnsubscribeToken,
} from '@/lib/email/unsubscribe-token'
import { WEEKLY_EMAIL_CONSENT_SHA256, WEEKLY_EMAIL_CONSENT_VERSION, isCurrentConsentVersion } from '@/lib/email/consent'
import { optinGlobalDailyCap, weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'

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

describe('token de confirmación del alta (doble opt-in)', () => {
  it('ida y vuelta: versión del texto y huella de la dirección', () => {
    const token = createOptinToken(USER, 'Ana@Example.com ', '2026-12-v1', SECRET, NOW)
    expect(verifyOptinToken(token, SECRET, NOW)).toEqual({
      ok: true,
      userId: USER,
      expiresAt: new Date(NOW.getTime() + OPTIN_TOKEN_TTL_SECONDS * 1000),
      textVersion: '2026-12-v1',
      emailHash: emailFingerprint('ana@example.com'),
    })
    // La dirección no va en claro.
    expect(Buffer.from(token.split('.')[1], 'base64url').toString()).not.toContain('example')
  })

  it('caduca a los 7 días', () => {
    const token = createOptinToken(USER, 'a@x.es', '2026-12-v1', SECRET, NOW)
    const later = new Date(NOW.getTime() + (OPTIN_TOKEN_TTL_SECONDS + 1) * 1000)
    expect(verifyOptinToken(token, SECRET, later)).toEqual({ ok: false, reason: 'expired' })
    expect(OPTIN_TOKEN_TTL_SECONDS).toBe(7 * 86400)
  })

  it('los propósitos no se intercambian: un enlace de baja no confirma y uno de alta no da de baja', () => {
    const unsub = createUnsubscribeToken(USER, SECRET, NOW)
    const optin = createOptinToken(USER, 'a@x.es', '2026-12-v1', SECRET, NOW)
    expect(verifyOptinToken(unsub, SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' })
    expect(verifyUnsubscribeToken(optin, SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('manipulado u otro secreto: no vale', () => {
    const token = createOptinToken(USER, 'a@x.es', '2026-12-v1', SECRET, NOW)
    expect(verifyOptinToken(token, 'y'.repeat(40), NOW)).toEqual({ ok: false, reason: 'bad_signature' })
    const [v, body, sig] = token.split('.')
    const forged = Buffer.from(Buffer.from(body, 'base64url').toString().replace('2026-12-v1', '2099-01-v9')).toString('base64url')
    expect(verifyOptinToken(`${v}.${forged}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
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

describe('migración: topes de confirmación y huella', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261215280001_calendar_email.sql'), 'utf8')
  const fn = (name: string) => {
    const start = sql.indexOf(`create or replace function public.${name}(`)
    // Sin comentarios: cuenta lo que se ejecuta.
    return sql.slice(start, sql.indexOf('$$;', start)).replace(/--.*$/gm, '')
  }

  // Regresión (revisión #49): la baja borraba optin_requested_at y alternar
  // alta/baja saltaba el límite de 10 min.
  it('la baja (set_email_weekly) no borra optin_requested_at ni los registros de envío', () => {
    const body = fn('set_email_weekly')
    expect(body).not.toMatch(/optin_requested_at\s*=\s*null/)
    expect(body).not.toMatch(/email_optin_requests/)
  })

  it('email_optin_claim: cooldown, tope por persona y global en una transacción con bloqueo', () => {
    const body = fn('email_optin_claim')
    expect(body).toContain('pg_advisory_xact_lock')
    expect(body).toMatch(/return 'cooldown'/)
    expect(body).toMatch(/return 'user_cap'/)
    expect(body).toMatch(/return 'global_cap'/)
    expect(sql).toMatch(/grant execute on function public\.email_optin_claim\(uuid, integer, integer, interval\) to service_role;/)
  })

  it('al confirmar se guarda la huella de la dirección y se rechaza un enlace anterior a la baja', () => {
    const body = fn('email_confirm_weekly')
    expect(body).toMatch(/confirmed_email_hash = excluded\.confirmed_email_hash/)
    expect(body).toMatch(/return 'superseded'/)
    expect(sql).toContain('drop function if exists public.email_confirm_weekly(uuid, text);')
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

  const confirmed = (email: string) => ({ email, email_confirmed_at: '2026-12-01T00:00:00Z' })

  it('con todo → activado para cualquiera con la dirección confirmada', () => {
    const config = weeklyEmailConfig(full)
    expect(config).toMatchObject({ enabled: true, from: 'KULTURA <onboarding@resend.dev>', only: null })
    expect(weeklyEmailAllowedFor(config, confirmed('cualquiera@example.com'))).toBe(true)
    expect(weeklyEmailAllowedFor(config, null)).toBe(false)
  })

  it('sin email_confirmed_at: nunca', () => {
    const config = weeklyEmailConfig(full)
    expect(weeklyEmailAllowedFor(config, { email: 'a@x.es', email_confirmed_at: null })).toBe(false)
    expect(weeklyEmailAllowedFor(config, { email: 'a@x.es' })).toBe(false)
  })

  it('WEEKLY_EMAIL_OPTIN_DAILY_CAP: 20 por defecto, entre 1 y 100', () => {
    expect(optinGlobalDailyCap({} as NodeJS.ProcessEnv)).toBe(20)
    expect(optinGlobalDailyCap({ WEEKLY_EMAIL_OPTIN_DAILY_CAP: '5' } as unknown as NodeJS.ProcessEnv)).toBe(5)
    expect(optinGlobalDailyCap({ WEEKLY_EMAIL_OPTIN_DAILY_CAP: '500' } as unknown as NodeJS.ProcessEnv)).toBe(100)
    expect(optinGlobalDailyCap({ WEEKLY_EMAIL_OPTIN_DAILY_CAP: 'x' } as unknown as NodeJS.ProcessEnv)).toBe(20)
  })

  it('WEEKLY_EMAIL_ONLY: solo esas direcciones (pruebas con onboarding@resend.dev)', () => {
    const config = weeklyEmailConfig({ ...full, WEEKLY_EMAIL_ONLY: ' Victor@Example.com , otra@x.es' } as NodeJS.ProcessEnv)
    expect(weeklyEmailAllowedFor(config, confirmed('victor@example.com'))).toBe(true)
    expect(weeklyEmailAllowedFor(config, confirmed('otra@x.es'))).toBe(true)
    expect(weeklyEmailAllowedFor(config, confirmed('nadie@x.es'))).toBe(false)
  })
})
