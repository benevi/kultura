// ============================================================
// KULTURA — Route Handler: /api/reports
// POST: crear reporte de usuario o título
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

const VALID_TARGET_TYPES = ['user', 'media'] as const
type TargetType = typeof VALID_TARGET_TYPES[number]

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

  let body: { targetType?: string; targetId?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.targetType || !(VALID_TARGET_TYPES as readonly string[]).includes(body.targetType)) {
    return NextResponse.json(
      { error: 'targetType must be "user" or "media"' },
      { status: 400 }
    )
  }
  if (!body.targetId || body.targetId.trim().length === 0) {
    return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
  }

  // No reportarse a sí mismo
  if (body.targetType === 'user' && body.targetId === user.id) {
    return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
  }

  // Verificar que el target existe
  if (body.targetType === 'user') {
    const { data: target } = await supabase
      .from('users')
      .select('id')
      .eq('id', body.targetId.trim())
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
  } else {
    const { data: target } = await supabase
      .from('media')
      .select('id')
      .eq('id', body.targetId.trim())
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      target_type: body.targetType as TargetType,
      target_id: body.targetId.trim(),
      reason: body.reason?.trim() ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  return NextResponse.json({ reportId: data.id }, { status: 201 })
}
