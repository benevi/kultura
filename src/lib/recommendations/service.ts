// ============================================================
// KULTURA — Recomendar un título a una amistad (saneamiento 9)
//
// Crea la fila de `recommendations` y, con el cliente admin, el aviso en
// `notifications` (que no tiene política de INSERT). No conoce HTTP: la ruta
// `/api/recommendations` convierte el resultado en respuesta.
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { upsertMediaFromProvider } from '@/lib/media/upsert-from-provider'
import { isRlsDenied } from '@/lib/social/friends'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import {
  RECOMMENDATION_ERRORS,
  type RecommendationCreateInput,
  type RecommendationCreated,
} from '@/lib/api/contracts/recommendations'

const log = createLogger('recommendations')

export async function recommendToFriend(
  supabase: SupabaseClient,
  user: User,
  input: RecommendationCreateInput,
  opts: { locale?: string | null } = {}
): Promise<ServiceResult<RecommendationCreated>> {
  if (input.toUserId === user.id) {
    return failure('invalid_input', { field: 'toUserId', message: RECOMMENDATION_ERRORS.self })
  }

  const { data: receiver } = await supabase.from('users').select('id').eq('id', input.toUserId).maybeSingle()
  if (!receiver) return failure('not_found', { message: 'User not found' })

  // Saneamiento 4.2 (Q7): solo a amistades aceptadas, y ANTES de pedir la
  // ficha al proveedor (sin esto, cualquiera gastaba cuota del proveedor con
  // recomendaciones que la base iba a rechazar). La RLS lo vuelve a exigir,
  // junto con que no haya bloqueo. Una sola fila posible por pareja (fase 3).
  const pair = [user.id, input.toUserId]
  const { data: friendship } = await supabase
    .from('friendships')
    .select('id')
    .eq('status', 'accepted')
    .in('requester_id', pair)
    .in('receiver_id', pair)
    .maybeSingle()
  if (!friendship) return failure('forbidden', { message: RECOMMENDATION_ERRORS.notFriends })

  const { data: senderProfile } = await supabase.from('users').select('username').eq('id', user.id).maybeSingle()

  // La fila de `media` (FK de recommendations) la garantiza el servidor con la
  // ficha del proveedor; `mediaCache` se ignora (SEG-2).
  const media = await upsertMediaFromProvider(input.mediaId, { locale: opts.locale })
  if (!media.ok) {
    if (media.reason === 'invalid_id') return failure('invalid_input', { field: 'mediaId', message: 'Unknown media id' })
    if (media.reason === 'unavailable') return failure('provider_unavailable', { message: 'Media provider unavailable' })
    return failure('internal', { message: 'Failed to cache media' })
  }

  const message = input.message ?? null
  const { data: recommendation, error: recError } = await supabase
    .from('recommendations')
    .insert({ from_user_id: user.id, to_user_id: input.toUserId, media_id: input.mediaId, message })
    .select('id')
    .single()

  // Saneamiento 2.4 (Q7): la RLS solo deja recomendar a amistades aceptadas.
  if (isRlsDenied(recError)) return failure('forbidden', { message: RECOMMENDATION_ERRORS.notFriends })
  if (recError || !recommendation) {
    log.error('no se pudo crear la recomendación', { err: recError })
    return failure('internal', { message: 'Failed to create recommendation' })
  }

  // El aviso no bloquea la recomendación si falla, pero queda registrado.
  const { error: notifErr } = await createAdminClient().from('notifications').insert({
    user_id: input.toUserId,
    type: 'recommendation',
    payload: {
      recommendationId: recommendation.id,
      fromUserId: user.id,
      fromUsername: (senderProfile as { username?: string } | null)?.username ?? '',
      mediaId: input.mediaId,
      // Del catálogo, no del remitente: la notificación la lee otra persona.
      mediaTitle: media.title,
      message,
    },
  })
  if (notifErr) log.error('[E83] notif insert failed', { type: 'recommendation', notifErr })

  return success({ recommendationId: recommendation.id as string })
}
