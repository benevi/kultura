// ============================================================
// KULTURA — Aviso al creador por cada denuncia (D-13, DSA art. 16)
//
// Cada denuncia (con sesión o desde el formulario público) manda un correo a
// MODERATION_EMAIL con Resend. Sin RESEND_API_KEY o sin MODERATION_EMAIL no se
// pierde: se registra como error (→ Sentry.captureMessage vía el logger) con la
// referencia, el tipo y el id del contenido, para que alguien la lea.
// Tope diario (Resend Free = 100 correos/día): 80 en total
// (MODERATION_EMAIL_DAILY_CAP) y 10 por denunciante, contados en `reports`;
// pasado el tope la denuncia sigue guardada y solo se registra en Sentry.
// Nunca lanza: una denuncia guardada no falla porque el correo falle.
// ============================================================

import { createLogger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { isEmailConfigured, sendEmail, type SendResult } from './resend'

const log = createLogger('moderation')

export interface ReportNotice {
  reportId: string
  reference: string
  targetType: string
  targetId: string
  reason: string
  details: string | null
  /** null en el formulario público. */
  reporterId: string | null
  /** Solo en el formulario público. */
  contactEmail: string | null
  /** false si no se pudo guardar en `reports` (migración sin aplicar): el correo es el único registro. */
  stored: boolean
  origin: 'app' | 'public_form'
}

/** Enlace al contenido denunciado cuando se puede construir sin consultar nada. */
export function targetUrl(targetType: string, targetId: string): string | null {
  const base = siteUrl()
  if (targetType === 'media') {
    const i = targetId.indexOf('_')
    if (i <= 0) return null
    return `${base}/es/media/${targetId.slice(0, i)}/${encodeURIComponent(targetId.slice(i + 1))}`
  }
  if (targetType === 'group') return `${base}/es/groups/${encodeURIComponent(targetId)}`
  return null
}

export function buildReportEmail(notice: ReportNotice): { subject: string; text: string } {
  const url = targetUrl(notice.targetType, notice.targetId)
  const lines = [
    `Nueva denuncia ${notice.reference} en KULTURA.`,
    '',
    `Contenido: ${notice.targetType} · ${notice.targetId}`,
    ...(url ? [`Enlace: ${url}`] : []),
    `Motivo: ${notice.reason}`,
    `Detalle: ${notice.details?.trim() || '(sin detalle)'}`,
    `Origen: ${notice.origin === 'public_form' ? 'formulario público (sin cuenta)' : 'app (con sesión)'}`,
    `Denunciante: ${notice.reporterId ?? '(sin cuenta)'}`,
    ...(notice.contactEmail ? [`Contacto: ${notice.contactEmail}`] : []),
    `Id: ${notice.reportId}`,
    '',
    notice.stored
      ? 'Para cerrarla (SQL Editor):'
      : 'ATENCIÓN: no se pudo guardar en la tabla reports (¿migración 20261101110001 sin aplicar?). Este correo es el único registro.',
    ...(notice.stored
      ? [
          `  update public.reports set resolved_at = now(), resolution = '<qué se hizo>'`,
          `   where id = '${notice.reportId}';`,
        ]
      : []),
  ]
  return {
    subject: `[KULTURA] Denuncia ${notice.reference} · ${notice.targetType} · ${notice.reason}`,
    text: lines.join('\n'),
  }
}

// ── Tope diario de correos (Resend Free: 100 al día) ─────────────────────────

/** Correos de denuncia al día en total (deja margen al resto de correos de la cuenta). */
export const EMAIL_DAILY_GLOBAL_CAP = 80
/** Correos al día por denunciante (usuario o correo de contacto). */
export const EMAIL_DAILY_PER_REPORTER_CAP = 10

const DAY_MS = 24 * 60 * 60_000

function globalCap(): number {
  const raw = Number.parseInt(process.env.MODERATION_EMAIL_DAILY_CAP ?? '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : EMAIL_DAILY_GLOBAL_CAP
}

function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

/**
 * Cuántas denuncias de hoy (UTC) hay en `reports`, en total y del mismo
 * denunciante. La fila de esta denuncia ya está insertada, así que cuenta.
 * `null` si no se puede contar (sin la migración no existe contact_email,
 * sin service role…): entonces se usa el contador en memoria.
 */
async function countToday(notice: ReportNotice): Promise<{ total: number; reporter: number } | null> {
  if (!notice.stored) return null
  try {
    const admin = createAdminClient()
    const since = startOfUtcDay(new Date())
    const total = admin.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', since)
    const mine = admin.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', since)
    const reporter = notice.reporterId
      ? mine.eq('reporter_id', notice.reporterId)
      : mine.eq('contact_email', notice.contactEmail ?? '')
    const [a, b] = await Promise.all([total, reporter])
    if (a.error || b.error || a.count === null || b.count === null) return null
    return { total: a.count, reporter: b.count }
  } catch {
    return null
  }
}

/** ¿Queda cupo de correo hoy? Si no, devuelve qué tope se ha superado. */
async function dailyCapExceeded(notice: ReportNotice): Promise<'global' | 'reporter' | null> {
  const cap = globalCap()
  const counted = await countToday(notice)
  if (counted) {
    if (counted.total > cap) return 'global'
    if (counted.reporter > EMAIL_DAILY_PER_REPORTER_CAP) return 'reporter'
    return null
  }
  // Respaldo en memoria (por instancia): menos fiable, pero nunca sin tope.
  const who = notice.reporterId ?? notice.contactEmail ?? 'anonymous'
  if (!checkRateLimit('moderation_email:global', { windowMs: DAY_MS, max: cap }).allowed) return 'global'
  if (!checkRateLimit(`moderation_email:${who}`, { windowMs: DAY_MS, max: EMAIL_DAILY_PER_REPORTER_CAP }).allowed) {
    return 'reporter'
  }
  return null
}

export type NotifyResult = SendResult | { ok: false; reason: 'daily_cap' }

export async function notifyReport(notice: ReportNotice): Promise<NotifyResult> {
  const to = process.env.MODERATION_EMAIL?.trim()
  const context = {
    reference: notice.reference,
    reportId: notice.reportId,
    targetType: notice.targetType,
    targetId: notice.targetId,
    stored: notice.stored,
  }

  if (!to) {
    log.error('moderation_email_not_configured', context)
    return { ok: false, reason: 'not_configured' }
  }

  // Pasado el tope la denuncia ya está guardada; solo queda constancia en Sentry.
  const capped = isEmailConfigured() ? await dailyCapExceeded(notice) : null
  if (capped) {
    log.error('moderation_email_daily_cap', { ...context, cap: capped })
    return { ok: false, reason: 'daily_cap' }
  }

  const { subject, text } = buildReportEmail(notice)
  const result = await sendEmail({
    to,
    subject,
    text,
    ...(notice.contactEmail ? { replyTo: notice.contactEmail } : {}),
  })

  if (!result.ok) {
    log.error(
      result.reason === 'not_configured' ? 'moderation_email_not_configured' : 'moderation_email_failed',
      { ...context, reason: result.reason, status: 'status' in result ? result.status : undefined },
    )
  }
  return result
}
