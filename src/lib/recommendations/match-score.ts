// ============================================================
// KULTURA — Match score real (F3a)
// Score de afinidad 0-100 por item, calculado server-side a partir de datos
// ya existentes en Supabase (biblioteca propia + de amigos). Cero llamadas a
// Claude/APIs externas — a diferencia de lib/claude/recommendations.ts, esto
// se calcula para docenas de items por carga de página, lo que hace
// inviable una llamada a LLM por item (y violaría la regla 1b de rate-limit
// de endpoints IA).
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaItem } from '@/types/media'

// Mismo umbral que getAiRecommendations (lib/claude/recommendations.ts):
// por debajo de esto no hay señal suficiente para un perfil de gustos fiable.
const MIN_LIBRARY_SIGNAL = 3

const PROFILE_CACHE_TTL_MS = 60 * 60 * 1000 // 1h, mismo patrón que recCache

export interface TasteProfile {
  /** Género → afinidad normalizada 0-1 (1 = género favorito del usuario). */
  genreWeights: Map<string, number>
  /** MediaType → afinidad normalizada 0-1. */
  typeWeights: Map<string, number>
  /** Nº de items de la biblioteca que aportaron señal real (score o completado/en curso). */
  signalCount: number
}

interface UserMediaRow {
  status: string
  score: number | null
  media: { type: string; metadata: Record<string, unknown> | null } | null
}

/** Peso de una fila de biblioteca como señal de gusto. 0 = sin señal (pending/abandoned sin score). */
function rowWeight(row: { status: string; score: number | null }): number {
  if (row.score != null) return row.score
  if (row.status === 'completed') return 3
  if (row.status === 'in_progress') return 1
  return 0
}

function normalize(map: Map<string, number>): Map<string, number> {
  const max = Math.max(0, ...Array.from(map.values()))
  if (max <= 0) return map
  const out = new Map<string, number>()
  Array.from(map.entries()).forEach(([key, value]) => out.set(key, value / max))
  return out
}

/** Pura, testeable sin Supabase: construye el perfil de gustos a partir de filas ya leídas. */
export function buildTasteProfile(rows: UserMediaRow[]): TasteProfile {
  const genreWeights = new Map<string, number>()
  const typeWeights = new Map<string, number>()
  let signalCount = 0

  for (const row of rows) {
    const weight = rowWeight(row)
    if (weight <= 0 || !row.media) continue
    signalCount++

    const genres = (row.media.metadata?.genres as string[] | undefined) ?? []
    for (const genre of genres) {
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight)
    }
    typeWeights.set(row.media.type, (typeWeights.get(row.media.type) ?? 0) + weight)
  }

  return {
    genreWeights: normalize(genreWeights),
    typeWeights: normalize(typeWeights),
    signalCount,
  }
}

/** Pura, testeable: score 0-100 de un item dado un perfil y una señal social 0-1. */
export function scoreItem(item: MediaItem, profile: TasteProfile, socialFraction = 0): number {
  const genres = item.genres ?? []
  const genreScore =
    genres.length === 0
      ? 0
      : genres.reduce((sum, g) => sum + (profile.genreWeights.get(g) ?? 0), 0) / genres.length
  const typeScore = profile.typeWeights.get(item.type) ?? 0

  const total = genreScore * 0.7 + typeScore * 0.15 + socialFraction * 0.15
  return Math.max(0, Math.min(100, Math.round(total * 100)))
}

const profileCache = new Map<string, { data: TasteProfile; expiresAt: number }>()

/** Invalidar tras cualquier mutación de user_media (mismo hook que invalidateRecCache). */
export function invalidateMatchScoreCache(userId: string): void {
  profileCache.delete(userId)
}

export async function getTasteProfile(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<TasteProfile> {
  const cached = profileCache.get(userId)
  if (cached && Date.now() < cached.expiresAt) return cached.data

  const supabase = supabaseClient ?? createClient()
  const { data } = await supabase
    .from('user_media')
    .select('status, score, media(type, metadata)')
    .eq('user_id', userId)

  const profile = buildTasteProfile((data ?? []) as unknown as UserMediaRow[])
  profileCache.set(userId, { data: profile, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS })
  return profile
}

interface FriendRow {
  requester_id: string
  receiver_id: string
}

interface FriendMediaRow {
  media_id: string
  status: string
  score: number | null
}

/** Fracción (0-1) de amigos aceptados que tienen cada media_id completado o con score>=4. */
async function getSocialSignal(
  userId: string,
  mediaIds: string[],
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (mediaIds.length === 0) return result

  const { data: friendRows } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)

  const friendIds = ((friendRows ?? []) as FriendRow[]).map((f) =>
    f.requester_id === userId ? f.receiver_id : f.requester_id
  )
  if (friendIds.length === 0) return result

  const { data: rows } = await supabase
    .from('user_media')
    .select('media_id, status, score')
    .in('user_id', friendIds)
    .in('media_id', mediaIds)

  const likedCountByMedia = new Map<string, number>()
  for (const row of (rows ?? []) as FriendMediaRow[]) {
    const liked = row.status === 'completed' || (row.score ?? 0) >= 4
    if (!liked) continue
    likedCountByMedia.set(row.media_id, (likedCountByMedia.get(row.media_id) ?? 0) + 1)
  }

  for (const id of mediaIds) {
    result.set(id, Math.min(1, (likedCountByMedia.get(id) ?? 0) / friendIds.length))
  }
  return result
}

/**
 * Match score 0-100 por item para `userId`. Devuelve un Map vacío si la
 * biblioteca del usuario no tiene señal suficiente (gate, MIN_LIBRARY_SIGNAL)
 * — nunca un número decorativo. Los items ausentes del Map no deben mostrar
 * badge de match en la UI.
 */
export async function computeMatchScores(
  userId: string,
  items: MediaItem[],
  supabaseClient?: SupabaseClient
): Promise<Map<string, number>> {
  const supabase = supabaseClient ?? createClient()
  const profile = await getTasteProfile(userId, supabase)

  if (profile.signalCount < MIN_LIBRARY_SIGNAL) return new Map()

  const social = await getSocialSignal(
    userId,
    items.map((item) => item.id),
    supabase
  )

  const scores = new Map<string, number>()
  for (const item of items) {
    scores.set(item.id, scoreItem(item, profile, social.get(item.id) ?? 0))
  }
  return scores
}
