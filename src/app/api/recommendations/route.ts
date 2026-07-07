// ============================================================
// KULTURA — Route Handler: /api/recommendations
// POST: crear una recomendación directa entre amigos.
// Crea fila en `recommendations` + fila en `notifications`.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

interface RecommendPayload {
  toUserId: string
  mediaId: string
  message?: string
  mediaCache?: {
    externalId: string
    type: string
    title: string
    poster?: string
    backdrop?: string
    year?: number
    synopsis?: string
  }
}

/** POST /api/recommendations */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limiting — 10 req/min por usuario
  const rl = checkRateLimit(`${user.id}:recommendations`, LIMITS.recommendations)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: RecommendPayload
  try {
    body = await request.json() as RecommendPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.toUserId) {
    return NextResponse.json({ error: 'toUserId is required' }, { status: 400 })
  }
  if (!body.mediaId) {
    return NextResponse.json({ error: 'mediaId is required' }, { status: 400 })
  }
  if (!/^[a-z]+_.+$/.test(body.mediaId)) {
    return NextResponse.json(
      { error: 'mediaId must follow the format "{type}_{externalId}"' },
      { status: 400 }
    )
  }
  if (body.toUserId === user.id) {
    return NextResponse.json(
      { error: 'Cannot recommend to yourself' },
      { status: 400 }
    )
  }
  // message es opcional; si viene, tope de longitud (recommendations.message es
  // TEXT sin constraint) para evitar payloads gigantes.
  if (body.message !== undefined && body.message !== null) {
    if (typeof body.message !== 'string' || body.message.length > 500) {
      return NextResponse.json(
        { error: 'message too long (max 500 chars)' },
        { status: 400 }
      )
    }
  }

  // Verificar que el receptor existe
  const { data: receiver } = await supabase
    .from('users')
    .select('id')
    .eq('id', body.toUserId)
    .maybeSingle()

  if (!receiver) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Obtener username del remitente para el payload de notificación
  const { data: senderProfile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  // Upsert media cache si viene
  if (body.mediaCache) {
    const { error: mediaError } = await supabase.from('media').upsert(
      {
        id: body.mediaId,
        external_id: body.mediaCache.externalId,
        type: body.mediaCache.type,
        title: body.mediaCache.title,
        poster: body.mediaCache.poster ?? null,
        backdrop: body.mediaCache.backdrop ?? null,
        year: body.mediaCache.year ?? null,
        synopsis: body.mediaCache.synopsis ?? null,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    if (mediaError) {
      return NextResponse.json({ error: 'Failed to cache media' }, { status: 500 })
    }
  }

  // Insertar recomendación
  const { data: recommendation, error: recError } = await supabase
    .from('recommendations')
    .insert({
      from_user_id: user.id,
      to_user_id: body.toUserId,
      media_id: body.mediaId,
      message: body.message ?? null,
    })
    .select('id')
    .single()

  if (recError || !recommendation) {
    return NextResponse.json({ error: 'Failed to create recommendation' }, { status: 500 })
  }

  // Notificación vía admin client (notifications no tiene policy INSERT para anon).
  // No bloquea la recomendación si falla; ya no es silencioso.
  const admin = createAdminClient()
  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: body.toUserId,
    type: 'recommendation',
    payload: {
      recommendationId: recommendation.id,
      fromUserId: user.id,
      fromUsername: senderProfile?.username ?? '',
      mediaId: body.mediaId,
      mediaTitle: body.mediaCache?.title ?? '',
      message: body.message ?? null,
    },
  })
  if (notifErr) console.error('[E83] notif insert failed', { type: 'recommendation', notifErr })

  return NextResponse.json({ recommendationId: recommendation.id }, { status: 201 })
}
