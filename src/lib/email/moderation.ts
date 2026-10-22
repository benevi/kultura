// ============================================================
// KULTURA — Aviso al creador por cada denuncia (D-13, DSA art. 16)
//
// Cada denuncia (con sesión o desde el formulario público) manda un correo a
// MODERATION_EMAIL con Resend. Sin RESEND_API_KEY o sin MODERATION_EMAIL no se
// pierde: se registra como error (→ Sentry.captureMessage vía el logger) con la
// referencia, el tipo y el id del contenido, para que alguien la lea.
// Nunca lanza: una denuncia guardada no falla porque el correo falle.
// ============================================================

import { createLogger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'
import { sendEmail, type SendResult } from './resend'

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

export async function notifyReport(notice: ReportNotice): Promise<SendResult> {
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
