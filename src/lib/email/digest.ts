// ============================================================
// KULTURA — Envío del correo semanal (F-28, CRE-9) · solo servidor
//
// Lo llama /api/cron/daily cada día; solo hace algo los lunes (hora de
// España) y, si quedó gente sin correo por el tope diario o por un fallo, el
// martes y el miércoles de esa misma semana (solo a quien ya estaba apuntado
// el lunes). Por persona y semana ISO hay UNA fila en `email_sends`
// (UNIQUE): se "reclama" antes de enviar, así un cron repetido o dos a la vez
// no mandan dos correos; además Resend recibe una Idempotency-Key por persona
// y semana. Esa clave solo protege 24 h, así que lo que NO se sabe si salió
// (fila "sending" de una ejecución cortada, fallo de red, excepción) solo se
// reintenta dentro de las primeras 23 h desde que se reclamó; pasado eso se da
// por perdido antes que arriesgar un duplicado. Lo que seguro no salió (Resend
// respondió con error HTTP) se reintenta hasta 3 veces en la ventana.
// Solo a direcciones confirmadas (email_confirmed_at) y que confirmaron el
// alta con el enlace del doble opt-in (las únicas con weekly_digest = true).
// Antes de cada envío se compara la huella de la dirección actual con la que
// confirmó: si la persona cambió de correo, no se envía, se desactiva
// (`email_reconfirm_required`) y se manda a la dirección nueva un enlace de
// confirmación (con los mismos topes que desde Ajustes).
//
// Topes: `WEEKLY_EMAIL_DAILY_CAP` correos por ejecución (por defecto 50:
// Resend Free son 100 al día y la moderación usa como mucho 80 en un día malo)
// y ~35 s de trabajo (la función de Hobby se corta a los 60 s).
// Sin datos personales en los registros: solo recuentos y códigos.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'
import { getUserCalendar } from '@/lib/calendar/data'
import { addDays, dateInZone, isoWeek, isoWeekday, type CalendarEvent } from '@/lib/calendar/types'
import { weeklyEmailAllowedFor, weeklyEmailConfig, type WeeklyEmailConfig } from './config'
import { isEmailNotMigrated, requireWeeklyReconfirm } from './preferences'
import { sendOptinRequest } from './optin'
import { sendEmail, type EmailMessage, type SendResult } from './resend'
import { createUnsubscribeToken, emailFingerprint } from './unsubscribe-token'
import { buildWeeklyEmail } from './weekly-template'

const log = createLogger('email/weekly')

export const WEEKLY_EMAIL_DEFAULT_CAP = 50
/** Último día ISO de la semana en que se recupera lo pendiente (1 = lunes, 3 = miércoles). */
export const WEEKLY_EMAIL_LAST_CATCHUP_DAY = 3
export const WEEKLY_EMAIL_MAX_ATTEMPTS = 3
/** Una fila "sending" más vieja que esto es de una ejecución que se cortó. */
export const STALE_SENDING_MS = 30 * 60_000
/**
 * Reintentos de envíos de resultado incierto: solo mientras la Idempotency-Key
 * de Resend (24 h desde la primera petición) siga evitando el duplicado.
 */
export const UNCERTAIN_RETRY_WINDOW_MS = 23 * 3600_000
export const WEEKLY_EMAIL_TIME_BUDGET_MS = 35_000
/** Peticiones a proveedores por persona en el correo (el calendario de 7 días). */
export const WEEKLY_EMAIL_CALENDAR_BUDGET = 25

export interface SendRow {
  id: string
  user_id: string
  status: 'sending' | 'sent' | 'failed' | 'skipped'
  attempts: number
  updated_at: string
  /** Primera vez que se reclamó (y se usó la Idempotency-Key). */
  created_at: string
  /** Código del último fallo (`http_error_500`, `network_error`…). */
  error?: string | null
}

export interface OptedIn {
  user_id: string
  consented_at: string | null
  /** Huella de la dirección que confirmó el alta. */
  confirmed_email_hash: string | null
}

export interface DigestStore {
  /** `null` = la migración aún no está aplicada. */
  listOptedIn(): Promise<OptedIn[] | null>
  listSends(period: string): Promise<SendRow[]>
  /** Reclama el envío de esta persona y semana; devuelve el id de la fila o null si otro lo tiene. */
  claim(userId: string, period: string, existing: SendRow | undefined): Promise<string | null>
  finish(
    id: string,
    patch: { status: 'sent' | 'failed' | 'skipped'; items?: number; provider_id?: string | null; error?: string | null }
  ): Promise<void>
  profiles(userIds: string[]): Promise<Map<string, { username: string; locale: 'es' | 'en' }>>
  /** Dirección de la cuenta SOLO si está confirmada (email_confirmed_at); si no, null. */
  email(userId: string): Promise<{ email: string; email_confirmed_at: string } | null>
  /** La dirección cambió: desactiva hasta que confirme la nueva. */
  requireReconfirm(userId: string): Promise<void>
}

export interface DigestDeps {
  store: DigestStore
  calendar: (userId: string, locale: 'es' | 'en', now: Date) => Promise<CalendarEvent[]>
  send: (message: EmailMessage) => Promise<SendResult>
  /** Enlace de confirmación a la dirección nueva (con topes); por defecto sendOptinRequest. */
  requestOptin?: (req: { userId: string; email: string; username: string; locale: 'es' | 'en' }) => Promise<string>
  config?: WeeklyEmailConfig
  now?: Date
  cap?: number
  timeBudgetMs?: number
  clock?: () => number
}

export type DigestResult =
  | { status: 'disabled'; reason: string }
  | { status: 'not_scheduled'; period: string }
  | { status: 'not_migrated'; period: string }
  | { status: 'error'; period: string }
  | {
      status: 'done'
      period: string
      eligible: number
      sent: number
      skipped: number
      failed: number
      /** Quedan para la próxima ejecución (tope o tiempo). */
      remaining: number
    }

function capFromEnv(): number {
  const n = Number(process.env.WEEKLY_EMAIL_DAILY_CAP)
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100) : WEEKLY_EMAIL_DEFAULT_CAP
}

/** ¿Resend contestó con un error HTTP? Entonces seguro que no salió. */
function certainlyNotSent(row: SendRow): boolean {
  return /^http_error_\d{3}$/.test(row.error ?? '')
}

export function needsSend(row: SendRow | undefined, now: Date): boolean {
  if (!row) return true
  if (row.attempts >= WEEKLY_EMAIL_MAX_ATTEMPTS) return false
  const withinKeyWindow = now.getTime() - new Date(row.created_at).getTime() < UNCERTAIN_RETRY_WINDOW_MS
  if (row.status === 'failed') return certainlyNotSent(row) || withinKeyWindow
  if (row.status === 'sending') {
    return withinKeyWindow && now.getTime() - new Date(row.updated_at).getTime() > STALE_SENDING_MS
  }
  return false
}

/** Enlaces del correo: calendario con UTM (Vercel Analytics) y marca de vuelta. */
export function weeklyLinks(locale: 'es' | 'en', period: string, token: string) {
  const base = siteUrl()
  const calendar = new URL(`${base}/${locale}/calendar`)
  calendar.searchParams.set('utm_source', 'email')
  calendar.searchParams.set('utm_medium', 'email')
  calendar.searchParams.set('utm_campaign', `weekly-${period}`)
  const unsubscribeApi = new URL(`${base}/api/email/unsubscribe`)
  unsubscribeApi.searchParams.set('t', token)
  unsubscribeApi.searchParams.set('l', locale)
  const unsubscribePage = new URL(`${base}/${locale}/email/unsubscribe`)
  unsubscribePage.searchParams.set('t', token)
  return {
    calendar: calendar.toString(),
    settings: `${base}/${locale}/settings#email`,
    unsubscribeApi: unsubscribeApi.toString(),
    unsubscribePage: unsubscribePage.toString(),
  }
}

export async function runWeeklyDigest(deps: DigestDeps): Promise<DigestResult> {
  const config = deps.config ?? weeklyEmailConfig()
  if (!config.enabled) return { status: 'disabled', reason: config.reason }

  const now = deps.now ?? new Date()
  const clock = deps.clock ?? Date.now
  const started = clock()
  const today = dateInZone(now)
  const weekday = isoWeekday(today)
  const period = isoWeek(today)
  if (weekday > WEEKLY_EMAIL_LAST_CATCHUP_DAY) return { status: 'not_scheduled', period }
  const monday = addDays(today, 1 - weekday)

  const optedIn = await deps.store.listOptedIn()
  if (optedIn === null) return { status: 'not_migrated', period }
  const sends = new Map((await deps.store.listSends(period)).map((r) => [r.user_id, r]))
  const optedInById = new Map(optedIn.map((p) => [p.user_id, p]))

  // El martes y el miércoles solo se recupera a quien ya estaba apuntado el lunes.
  const eligible = optedIn.filter(
    (p) => weekday === 1 || (p.consented_at !== null && dateInZone(new Date(p.consented_at)) < monday)
  )
  const todo = eligible.filter((p) => needsSend(sends.get(p.user_id), now))
  const cap = deps.cap ?? capFromEnv()
  const batch = todo.slice(0, cap)
  const profiles = batch.length ? await deps.store.profiles(batch.map((p) => p.user_id)) : new Map()

  let sent = 0
  let skipped = 0
  let failed = 0
  let processed = 0
  for (const { user_id: userId } of batch) {
    if (clock() - started > (deps.timeBudgetMs ?? WEEKLY_EMAIL_TIME_BUDGET_MS)) break
    processed++
    const rowId = await deps.store.claim(userId, period, sends.get(userId))
    if (!rowId) {
      skipped++
      continue
    }
    try {
      const profile = profiles.get(userId)
      const recipient = await deps.store.email(userId)
      const email = recipient?.email ?? null
      if (!profile || !recipient || !email || !weeklyEmailAllowedFor(config, recipient)) {
        await deps.store.finish(rowId, { status: 'skipped', error: !profile || !email ? 'no_recipient' : 'not_allowed' })
        skipped++
        continue
      }
      const confirmedHash = optedInById.get(userId)?.confirmed_email_hash ?? null
      if (confirmedHash !== emailFingerprint(email)) {
        // Cambió de dirección desde que confirmó: nada a la nueva sin su confirmación.
        await deps.store.requireReconfirm(userId)
        await deps.store.finish(rowId, { status: 'skipped', error: 'email_changed' })
        await (deps.requestOptin ?? (() => Promise.resolve('skipped')))({
          userId,
          email,
          username: profile.username,
          locale: profile.locale,
        }).catch(() => 'error')
        skipped++
        continue
      }
      const week = (await deps.calendar(userId, profile.locale, now)).filter(
        (e) => e.precision === 'day' && e.date !== null && e.date >= today && e.date <= addDays(today, 6)
      )
      if (week.length === 0) {
        // Nada esta semana: mejor ningún correo que uno vacío.
        await deps.store.finish(rowId, { status: 'skipped', items: 0, error: 'empty' })
        skipped++
        continue
      }
      const links = weeklyLinks(profile.locale, period, createUnsubscribeToken(userId, config.secret, now))
      const content = buildWeeklyEmail({
        locale: profile.locale,
        username: profile.username,
        events: week,
        calendarUrl: links.calendar,
        settingsUrl: links.settings,
        unsubscribeUrl: links.unsubscribePage,
      })
      const result = await deps.send({
        from: config.from,
        to: email,
        subject: content.subject,
        text: content.text,
        html: content.html,
        headers: {
          // RFC 2369 + RFC 8058: baja en un clic desde el propio cliente de correo.
          'List-Unsubscribe': `<${links.unsubscribeApi}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        idempotencyKey: `weekly-${period}-${userId}`,
      })
      if (result.ok) {
        await deps.store.finish(rowId, { status: 'sent', items: Math.min(week.length, 32767), provider_id: result.id })
        sent++
      } else {
        await deps.store.finish(rowId, {
          status: 'failed',
          error: result.status ? `${result.reason}_${result.status}` : result.reason,
        })
        failed++
      }
    } catch (e) {
      failed++
      log.warn('correo semanal: un envío falló', { message: e instanceof Error ? e.name : 'unknown' })
      await deps.store.finish(rowId, { status: 'failed', error: 'exception' }).catch(() => {})
    }
  }

  const summary = {
    status: 'done' as const,
    period,
    eligible: eligible.length,
    sent,
    skipped,
    failed,
    remaining: todo.length - processed,
  }
  log.info('correo semanal', summary)
  return summary
}

// ── Almacén real (Supabase con service role) ────────────────────────────────

const LOCALES = new Set(['es', 'en'])

export function supabaseDigestStore(admin: SupabaseClient): DigestStore {
  return {
    async listOptedIn() {
      const { data, error } = await admin
        .from('email_preferences')
        .select('user_id, consented_at, confirmed_email_hash')
        .eq('weekly_digest', true)
        .order('user_id', { ascending: true })
        .limit(2000)
      if (error) {
        if (isEmailNotMigrated(error)) return null
        throw new Error(`email_preferences: ${error.code ?? 'error'}`)
      }
      return (data ?? []) as OptedIn[]
    },
    async listSends(period) {
      const { data, error } = await admin
        .from('email_sends')
        .select('id, user_id, status, attempts, updated_at, created_at, error')
        .eq('kind', 'weekly')
        .eq('period', period)
        .limit(5000)
      if (error) throw new Error(`email_sends: ${error.code ?? 'error'}`)
      return (data ?? []) as SendRow[]
    },
    async claim(userId, period, existing) {
      if (!existing) {
        const { data, error } = await admin
          .from('email_sends')
          .upsert(
            { user_id: userId, kind: 'weekly', period, status: 'sending' },
            { onConflict: 'user_id,kind,period', ignoreDuplicates: true }
          )
          .select('id')
        if (error) throw new Error(`email_sends claim: ${error.code ?? 'error'}`)
        return (data as Array<{ id: string }> | null)?.[0]?.id ?? null
      }
      // Reintento: solo si sigue como estaba (otra ejecución no la ha cogido).
      const { data, error } = await admin
        .from('email_sends')
        .update({ status: 'sending', attempts: existing.attempts + 1, updated_at: new Date().toISOString(), error: null })
        .eq('id', existing.id)
        .eq('status', existing.status)
        .eq('attempts', existing.attempts)
        .select('id')
      if (error) throw new Error(`email_sends retry: ${error.code ?? 'error'}`)
      return (data as Array<{ id: string }> | null)?.[0]?.id ?? null
    },
    async finish(id, patch) {
      const now = new Date().toISOString()
      const { error } = await admin
        .from('email_sends')
        .update({
          status: patch.status,
          items: patch.items ?? 0,
          provider_id: patch.provider_id ?? null,
          error: patch.error ?? null,
          updated_at: now,
          sent_at: patch.status === 'sent' ? now : null,
        })
        .eq('id', id)
      if (error) throw new Error(`email_sends finish: ${error.code ?? 'error'}`)
    },
    async profiles(userIds) {
      const { data, error } = await admin.from('users').select('id, username, preferred_locale').in('id', userIds)
      if (error) throw new Error(`users: ${error.code ?? 'error'}`)
      const out = new Map<string, { username: string; locale: 'es' | 'en' }>()
      for (const row of (data ?? []) as Array<{ id: string; username: string; preferred_locale: string | null }>) {
        out.set(row.id, {
          username: row.username,
          locale: LOCALES.has(row.preferred_locale ?? '') ? (row.preferred_locale as 'es' | 'en') : 'es',
        })
      }
      return out
    },
    async requireReconfirm(userId) {
      await requireWeeklyReconfirm(admin, userId)
    },
    async email(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      const user = data?.user
      // Sin dirección confirmada no se envía nada (aunque la fila diga weekly_digest).
      if (error || !user?.email || !user.email_confirmed_at) return null
      return { email: user.email, email_confirmed_at: user.email_confirmed_at }
    },
  }
}

/** Lo que usa el cron: Supabase + calendario real + Resend. */
export function defaultDigestDeps(admin: SupabaseClient, now: Date = new Date()): DigestDeps {
  return {
    store: supabaseDigestStore(admin),
    calendar: async (userId, locale, at) =>
      (
        await getUserCalendar(admin, userId, locale, {
          now: at,
          daysAhead: 6,
          budget: WEEKLY_EMAIL_CALENDAR_BUDGET,
          cache: false,
        })
      ).events,
    send: sendEmail,
    requestOptin: async (req) => {
      const config = weeklyEmailConfig()
      // Sin `now` del cron: el enlace se firma DESPUÉS de la baja de
      // email_reconfirm_required y de la reserva; con la hora de inicio del
      // cron nacía anterior a la baja y la base lo daba por `superseded`.
      return config.enabled ? sendOptinRequest(admin, config, req) : 'disabled'
    },
    now,
  }
}

/** Marca que la persona volvió desde el correo de esa semana (1.ª vez). Nunca lanza. */
export async function markWeeklyReturn(admin: Pick<SupabaseClient, 'from'>, userId: string, period: string): Promise<void> {
  try {
    await admin
      .from('email_sends')
      .update({ returned_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('kind', 'weekly')
      .eq('period', period)
      .is('returned_at', null)
  } catch {
    // Medición: si falla, no pasa nada.
  }
}

/** `utm_campaign=weekly-2026-W51` → "2026-W51". */
export function weeklyPeriodFromCampaign(source: unknown, campaign: unknown): string | null {
  if (source !== 'email' || typeof campaign !== 'string') return null
  const m = /^weekly-(\d{4}-W\d{2})$/.exec(campaign)
  return m ? m[1] : null
}
