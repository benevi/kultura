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
import { backfillGenres } from '@/lib/library/backfill-genres'
import { canonicalGenres } from '@/lib/recommendations/genre-canonical'
import { createLogger } from '@/lib/logger'

const log = createLogger('recommendations/match-score')

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

/** Lo ÚNICO que el perfil necesita de una fila: peso y géneros. */
interface TasteSignalRow {
  status: string
  score: number | null
  media: { type: string; metadata: Record<string, unknown> | null } | null
}

/** La fila tal como se lee de Supabase: además identifica al título, para poder reparar sus géneros. */
interface UserMediaRow extends TasteSignalRow {
  media:
    | { id: string; type: string; external_id: string; metadata: Record<string, unknown> | null }
    | null
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
export function buildTasteProfile(rows: TasteSignalRow[]): TasteProfile {
  const genreWeights = new Map<string, number>()
  const typeWeights = new Map<string, number>()
  let signalCount = 0

  for (const row of rows) {
    const weight = rowWeight(row)
    if (weight <= 0 || !row.media) continue
    signalCount++

    // E-MATCH-VOCAB: el perfil se indexa por slug canónico, no por el nombre
    // que puso el proveedor — así una biblioteca de cine en español puede
    // puntuar un anime o un juego, y cambiar el idioma de la app no parte el
    // perfil en dos ("Acción" vs "Action").
    const genres = canonicalGenres(row.media.metadata?.genres as string[] | undefined)
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

/**
 * Pura, testeable: score 0-100 de un item dado un perfil y una señal social 0-1.
 *
 * `includeTypeAffinity` (default true) permite excluir el componente de
 * afinidad de tipo: cuando todos los items evaluados en una misma vista
 * comparten tipo (F3a-FIX — típico de Discover filtrado por `type=movie`,
 * etc.), ese componente da el mismo valor a todos y no discrimina nada —
 * incluirlo ahí colapsa el score a una constante disfrazada de personalización.
 * Al excluirlo, su peso (0.15) se redistribuye proporcionalmente entre género
 * y social para que sigan sumando 1.0.
 */
export function scoreItem(
  item: MediaItem,
  profile: TasteProfile,
  socialFraction = 0,
  options: { includeTypeAffinity?: boolean } = {}
): number {
  const includeTypeAffinity = options.includeTypeAffinity ?? true

  // E-MATCH-VOCAB: mismo vocabulario que el perfil (ver buildTasteProfile).
  const genres = canonicalGenres(item.genres)
  const genreScore =
    genres.length === 0
      ? 0
      : genres.reduce((sum, g) => sum + (profile.genreWeights.get(g) ?? 0), 0) / genres.length
  const typeScore = includeTypeAffinity ? (profile.typeWeights.get(item.type) ?? 0) : 0

  const weights = includeTypeAffinity
    ? { genre: 0.7, type: 0.15, social: 0.15 }
    : { genre: 0.7 / 0.85, type: 0, social: 0.15 / 0.85 }

  const total = genreScore * weights.genre + typeScore * weights.type + socialFraction * weights.social
  return Math.max(0, Math.min(100, Math.round(total * 100)))
}

const profileCache = new Map<string, { data: TasteProfile; expiresAt: number }>()

/** Invalidar tras cualquier mutación de user_media (mismo hook que invalidateRecCache). */
export function invalidateMatchScoreCache(userId: string): void {
  profileCache.delete(userId)
}

export async function getTasteProfile(
  userId: string,
  supabaseClient?: SupabaseClient,
  locale?: string | null
): Promise<TasteProfile> {
  const cached = profileCache.get(userId)
  if (cached && Date.now() < cached.expiresAt) return cached.data

  const supabase = supabaseClient ?? createClient()
  const { data } = await supabase
    .from('user_media')
    .select('status, score, media(id, type, external_id, metadata)')
    .eq('user_id', userId)

  const rows = (data ?? []) as unknown as UserMediaRow[]

  // E-MATCH-GENRES: las filas cacheadas antes de que se guardase el género
  // (2026-09-12) no tienen ninguno, y sin géneros el perfil queda vacío y TODO
  // da 0% MATCH. Se reparan aquí, y solo las que aportan señal: una entrada
  // pendiente o abandonada sin nota no pinta en el perfil, así que no merece
  // una llamada al proveedor.
  const repairable = rows
    .filter((row) => row.media !== null && rowWeight(row) > 0)
    .map((row) => row.media!)
  const healed = await backfillGenres(repairable, supabase, locale).catch((err) => {
    log.warn('backfill de géneros omitido', { err })
    return new Map<string, string[]>()
  })

  const profile = buildTasteProfile(
    healed.size === 0
      ? rows
      : rows.map((row) => {
          const genres = row.media ? healed.get(row.media.id) : undefined
          if (!genres) return row
          return { ...row, media: { ...row.media!, metadata: { ...(row.media!.metadata ?? {}), genres } } }
        })
  )
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
  supabaseClient?: SupabaseClient,
  locale?: string | null
): Promise<Map<string, number>> {
  const supabase = supabaseClient ?? createClient()
  // `locale` solo se usa al reparar géneros que falten (E-MATCH-GENRES): los
  // nombres los sirve cada proveedor en el idioma pedido, así que conviene que
  // coincida con el del catálogo que se está puntuando.
  const profile = await getTasteProfile(userId, supabase, locale)

  if (profile.signalCount < MIN_LIBRARY_SIGNAL) return new Map()

  const social = await getSocialSignal(
    userId,
    items.map((item) => item.id),
    supabase
  )

  // F3a-FIX: si todos los items de esta vista son del mismo tipo (Discover
  // filtrado por type=movie/tv/...), la afinidad de tipo es una constante que
  // no discrimina nada entre ellos — se excluye del cálculo en ese caso. En
  // modo agregado (type=all) o filas que mezclan tipos (GenreNews) sigue
  // contribuyendo normalmente.
  const includeTypeAffinity = new Set(items.map((item) => item.type)).size > 1

  const scores = new Map<string, number>()
  for (const item of items) {
    scores.set(item.id, scoreItem(item, profile, social.get(item.id) ?? 0, { includeTypeAffinity }))
  }
  return scores
}
