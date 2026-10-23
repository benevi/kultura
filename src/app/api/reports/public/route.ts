// ============================================================
// KULTURA — Route Handler: /api/reports/public
// POST: denuncia SIN cuenta (formulario /[locale]/report, DSA art. 16).
// Trampa para bots (campo `website`), límite por IP y declaración de buena
// fe. Inserta el servidor con el service role (anon no toca `reports`).
// Antes de la migración (reporter_id NOT NULL, sin contact_email) la
// denuncia no se puede guardar: se manda igualmente por email, que queda
// como registro, y el denunciante recibe su referencia.
// ============================================================

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/api/discover-params'
import { createLogger } from '@/lib/logger'
import { notifyReport } from '@/lib/email/moderation'
import { isModerationV2, isNotMigratedError } from '@/lib/social/friends'
import { reportReference, type ReportTargetType } from '@/lib/social/actions'
import { PublicReportSchema, allowedTargetTypes, checkPublicTarget, storedReason } from '../shared'

const log = createLogger('api/reports/public')

/** 5 denuncias por hora y IP: suficiente para una persona, caro para un bot. */
const PUBLIC_REPORT_LIMIT = { windowMs: 60 * 60_000, max: 5 }

/** Errores que indican que la tabla aún no admite la denuncia sin cuenta. */
const LEGACY_SCHEMA_CODES = new Set(['23502', '23514'])

export async function POST(request: Request): Promise<NextResponse> {
  const rl = checkRateLimit(`${clientIp(request.headers)}:reports_public`, PUBLIC_REPORT_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'too_many_requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null

  // Trampa: si el campo oculto viene relleno, se responde como si todo fuera
  // bien pero no se guarda ni se envía nada.
  if (body && typeof body.website === 'string' && body.website.trim() !== '') {
    const fake = crypto.randomUUID()
    return NextResponse.json({ reportId: fake, reference: reportReference(fake) }, { status: 201 })
  }

  const parsed = PublicReportSchema.safeParse(body)
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    return NextResponse.json({ error: 'invalid_body', field: typeof field === 'string' ? field : null }, { status: 400 })
  }

  const allowed = allowedTargetTypes(isModerationV2(), 'public')
  if (!(allowed as readonly string[]).includes(parsed.data.targetType)) {
    return NextResponse.json({ error: 'invalid_target_type', field: 'targetType' }, { status: 400 })
  }
  const targetType = parsed.data.targetType as ReportTargetType

  const admin = createAdminClient()
  const target = await checkPublicTarget(admin, targetType, parsed.data.target)
  if (!target.ok) {
    return NextResponse.json({ error: target.error, field: 'target' }, { status: target.status })
  }

  const reportId = crypto.randomUUID()
  const { reason, details, contactEmail } = parsed.data

  const { error } = await admin.from('reports').insert({
    id: reportId,
    reporter_id: null,
    contact_email: contactEmail,
    target_type: targetType,
    target_id: target.targetId,
    reason: storedReason(reason, details),
  })

  let stored = true
  if (error) {
    if (isNotMigratedError(error) || LEGACY_SCHEMA_CODES.has(error.code ?? '')) {
      stored = false
      log.warn('public report not stored: moderation migration pending', { code: error.code })
    } else {
      log.error('public report insert failed', { err: error, targetType })
      return NextResponse.json({ error: 'report_failed' }, { status: 500 })
    }
  }

  const reference = reportReference(reportId)
  const sent = await notifyReport({
    reportId,
    reference,
    targetType,
    targetId: target.targetId,
    reason,
    details,
    reporterId: null,
    contactEmail,
    stored,
    origin: 'public_form',
  })

  // Sin guardar y sin correo no queda constancia: mejor decirlo que fingir.
  if (!stored && !sent.ok) {
    return NextResponse.json({ error: 'report_failed' }, { status: 503 })
  }

  return NextResponse.json({ reportId, reference }, { status: 201 })
}
