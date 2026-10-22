// ============================================================
// KULTURA — Route Handler: /api/reports
// POST: denuncia con sesión de un usuario, título, mensaje, post de grupo,
// grupo o lista (los cuatro últimos con MODERATION_V2). Cada denuncia avisa
// por email al creador y devuelve un número de referencia.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import { notifyReport } from '@/lib/email/moderation'
import { isModerationV2 } from '@/lib/social/friends'
import { reportReference, type ReportTargetType } from '@/lib/social/actions'
import {
  AppReportSchema,
  allowedTargetTypes,
  checkTargetAsUser,
  normalizeReason,
  storedReason,
} from './shared'

const log = createLogger('api/reports')

/** POST /api/reports */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limiting — 5 req/min por usuario
  const rl = checkRateLimit(`${user.id}:reports`, LIMITS.reports)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = AppReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const allowed = allowedTargetTypes(isModerationV2(), 'app')
  if (!(allowed as readonly string[]).includes(parsed.data.targetType)) {
    return NextResponse.json({ error: 'invalid_target_type' }, { status: 400 })
  }
  const targetType = parsed.data.targetType as ReportTargetType
  const targetId = parsed.data.targetId

  // No denunciarse a sí mismo
  if (targetType === 'user' && targetId === user.id) {
    return NextResponse.json({ error: 'cannot_report_self' }, { status: 400 })
  }

  const target = await checkTargetAsUser(supabase, targetType, targetId)
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status })
  }

  const { reason, details } = normalizeReason(parsed.data.reason, parsed.data.details)

  // El id se genera aquí y se inserta SIN `.select()`: `reports` no tenía
  // política SELECT, y un INSERT … RETURNING exige que la fila nueva pase la
  // RLS de SELECT. Con `.select('id')` la denuncia fallaba siempre (42501).
  const reportId = crypto.randomUUID()
  const { error } = await supabase.from('reports').insert({
    id: reportId,
    reporter_id: user.id,
    target_type: targetType,
    target_id: target.targetId,
    reason: storedReason(reason, details),
  })

  if (error) {
    log.error('report insert failed', { err: error, targetType })
    return NextResponse.json({ error: 'report_failed' }, { status: 500 })
  }

  const reference = reportReference(reportId)
  await notifyReport({
    reportId,
    reference,
    targetType,
    targetId: target.targetId,
    reason,
    details,
    reporterId: user.id,
    contactEmail: null,
    stored: true,
    origin: 'app',
  })

  return NextResponse.json({ reportId, reference }, { status: 201 })
}
