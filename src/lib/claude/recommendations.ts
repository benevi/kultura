// ============================================================
// KULTURA — Recomendaciones IA (E-AIREC-CATALOG)
//
// Arquitectura (reescrita 2026-09-13): los títulos NO los inventa el modelo.
//
// Antes se le pedían títulos libres a Claude y luego se intentaba "resolverlos"
// con `searchByType`. Eso fallaba por dos sitios a la vez:
//   - Resolución: cualquier búsqueda sin resultado dejaba la rec fuera, así que
//     de 5 recomendaciones se pintaba una sola card.
//   - Enlace: se construía `/media/{type}/{item.id}` con el id PREFIJADO
//     (`game_667657`), pero la ficha hace `Number(id)` → NaN → RAWG resolvía el
//     slug "nan" y servía SIEMPRE el mismo juego, fuese cual fuese la card.
//     La convención correcta es `externalId` (la que usa `MediaCard`).
//
// Ahora el flujo va al revés y se apoya en lo que ya funciona:
//   1. Candidatos REALES del catálogo vía `fetchDiscoverData` — el mismo
//      pipeline que alimenta Descubrir → ids válidos, portadas reales y ficha
//      garantizada, sin búsquedas intermedias que puedan fallar.
//   2. Se puntúan con el match real (`computeMatchScores`, F3a).
//   3. Claude elige UNO POR TIPO entre los mejores y escribe el porqué.
//
// Si Claude falla, va sin clave o alucina un id, se sirve el de mayor match de
// ese tipo: la sección nunca se queda vacía por un fallo del modelo.
//
// Solo para uso server-side — ANTHROPIC_API_KEY nunca al cliente.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaItem, MediaType } from '@/types/media'
import { fetchDiscoverData } from '@/lib/api/discover'
import { computeMatchScores } from '@/lib/recommendations/match-score'
import { createLogger } from '@/lib/logger'

const log = createLogger('claude/recommendations')

// v6: reescritura a catálogo real + match (E-AIREC-CATALOG). Invalida v5, cuyas
// entradas guardaban la forma vieja de AiRec (title/searchQuery/mediaUrl).
const PROMPT_VERSION = 'v6'

/** Una card de "Para ti": ítem real del catálogo, su match y el porqué. */
export interface AiRec {
  /** Ítem tal cual lo sirve el catálogo: la ficha se enlaza con su `externalId`. */
  item: MediaItem
  /** Match real 0-100 (`computeMatchScores`) — el criterio de la recomendación. */
  matchScore: number
  /**
   * Explicación escrita por Claude en el idioma activo. Ausente cuando el modelo
   * no pudo responder: la UI pinta entonces el porqué localizado a partir del
   * match y los géneros, así que la card sigue siendo útil.
   */
  reason?: string
}

/** Un título de cada tipo, en este orden de presentación. */
const RECOMMENDABLE_TYPES: MediaType[] = [
  'movie',
  'tv',
  'anime',
  'book',
  'manga',
  'comic',
  'game',
]

/** Candidatos por tipo que se guardan en la shortlist cacheada, ordenados por match. */
const CANDIDATES_PER_TYPE = 5

/**
 * Cuántos de esa shortlist se le ofrecen a Claude EN CADA VISITA (E-AIREC-ROTACION).
 *
 * La sección enseñaba siempre lo mismo: la shortlist se ordena por match, así
 * que el mejor de cada tipo ganaba una y otra vez. Ahora la ventana rota en
 * cada visita a Inicio, de modo que Claude elige entre candidatos distintos sin
 * dejar de decidir por match — la alternativa (elegir al azar) habría roto
 * justo el criterio que pediste.
 */
const WINDOW_PER_TYPE = 2

/**
 * Páginas de catálogo entre las que rota la shortlist al refrescarse. Sin esto
 * los candidatos saldrían siempre del mismo puñado de títulos populares.
 */
const CATALOG_PAGES = 3

/** Mínimo de items con señal en biblioteca (mismo gate que computeMatchScores). */
const MIN_LIBRARY_ITEMS = 3

interface LibraryItem {
  title: string
  type: string
  year: number | null
  score: number | null
  status: string
}

// ── Cache en memoria ──────────────────────────────────────────────────────────
//
// Lo que se cachea es la SHORTLIST (lo caro: 7 llamadas a proveedores + el
// cálculo de match), NO el resultado final. Así cada visita puede enseñar una
// recomendación distinta sin volver a barrer el catálogo.
// En multi-instancia de Vercel, migrar a KV/Redis.

const POOL_CACHE_TTL_MS = 30 * 60 * 1000 // 30 min

interface ShortlistEntry {
  shortlist: Map<MediaType, MediaItem[]>
  scores: Map<string, number>
  expiresAt: number
}

const poolCache = new Map<string, ShortlistEntry>()

/**
 * Cuántas veces se ha servido ya la sección, por usuario e idioma: es lo que
 * hace rotar la ventana de candidatos en cada visita (E-AIREC-ROTACION).
 */
const rotationCounter = new Map<string, number>()

function getCachedPool(key: string): ShortlistEntry | null {
  const entry = poolCache.get(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    poolCache.delete(key)
    return null
  }
  return entry
}

/** Invalida todas las entradas de caché de un usuario (todas las variantes de locale/versión). */
export function invalidateRecCache(userId: string): void {
  const prefix = `${userId}:`
  Array.from(poolCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) poolCache.delete(key)
  })
  Array.from(rotationCounter.keys()).forEach((key) => {
    if (key.startsWith(prefix)) rotationCounter.delete(key)
  })
}

/**
 * Obtiene los items relevantes de la biblioteca para el prompt:
 * completados o con score >= 4, ordenados por updated_at DESC, máx 15.
 */
export async function getLibraryContext(userId: string, supabaseClient?: SupabaseClient): Promise<LibraryItem[]> {
  const supabase = supabaseClient ?? createClient()

  const { data } = await supabase
    .from('user_media')
    .select('status, score, updated_at, media(title, type, year)')
    .eq('user_id', userId)
    .or('status.eq.completed,score.gte.4')
    .order('updated_at', { ascending: false })
    .limit(15)

  if (!data) return []

  return (data as unknown as Array<{
    status: string
    score: number | null
    media: { title: string; type: string; year: number | null } | null
  }>)
    .filter((row) => row.media !== null)
    .map((row) => ({
      title: row.media!.title,
      type: row.media!.type,
      year: row.media!.year,
      score: row.score,
      status: row.status,
    }))
}

/** Ids (`{type}_{externalId}`) que el usuario ya tiene en biblioteca. */
async function getOwnedMediaIds(userId: string, supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase
    .from('user_media')
    .select('media_id')
    .eq('user_id', userId)

  return new Set(((data ?? []) as Array<{ media_id: string }>).map((row) => row.media_id))
}

/**
 * Candidatos por tipo desde el MISMO pipeline que Descubrir.
 *
 * `fetchDiscoverData` no lanza (captura y devuelve `fetchErrorKind`), así que un
 * proveedor caído deja su tipo sin card en lugar de tumbar la sección entera.
 * Se descartan los que ya están en biblioteca (no se recomienda lo que ya tiene)
 * y los que no traen portada (misma regla que el resto de superficies).
 */
async function fetchCandidatePools(
  locale: string,
  owned: Set<string>,
  page = 1
): Promise<Map<MediaType, MediaItem[]>> {
  const entries = await Promise.all(
    RECOMMENDABLE_TYPES.map(async (type) => {
      const res = await fetchDiscoverData(type, page, {}, locale)
      if (res.fetchErrorKind) {
        log.warn('candidatos vacíos por fallo de proveedor', { type, kind: res.fetchErrorKind })
      }
      const items = res.items.filter((item) => Boolean(item.poster) && !owned.has(item.id))
      return [type, items] as const
    })
  )

  const pools = new Map<MediaType, MediaItem[]>()
  for (const [type, items] of entries) {
    if (items.length > 0) pools.set(type, items)
  }
  return pools
}

/** Top `CANDIDATES_PER_TYPE` de cada tipo ordenados por match descendente. */
function shortlistByType(
  pools: Map<MediaType, MediaItem[]>,
  scores: Map<string, number>
): Map<MediaType, MediaItem[]> {
  const shortlist = new Map<MediaType, MediaItem[]>()
  Array.from(pools.entries()).forEach(([type, items]) => {
    const ranked = [...items].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    shortlist.set(type, ranked.slice(0, CANDIDATES_PER_TYPE))
  })
  return shortlist
}

/**
 * Ventana rotada de candidatos para ESTA visita (E-AIREC-ROTACION).
 *
 * Cada tipo arranca en un punto distinto de su shortlist (`offset` + índice del
 * tipo) y da la vuelta al llegar al final, así que dos visitas seguidas no
 * ofrecen los mismos títulos aunque la shortlist esté cacheada. Se sigue
 * eligiendo por match: la ventana solo decide entre CUÁLES se elige.
 */
function rotateWindow(
  shortlist: Map<MediaType, MediaItem[]>,
  offset: number
): Map<MediaType, MediaItem[]> {
  const windowed = new Map<MediaType, MediaItem[]>()
  Array.from(shortlist.entries()).forEach(([type, items], typeIndex) => {
    if (items.length === 0) return
    const start = (offset + typeIndex) % items.length
    const size = Math.min(WINDOW_PER_TYPE, items.length)
    const picked = Array.from({ length: size }, (_, i) => items[(start + i) % items.length])
    windowed.set(type, picked)
  })
  return windowed
}

/**
 * Prompt de ELECCIÓN (no de invención): Claude solo puede escoger entre ids que
 * ya existen en el catálogo, con su match real delante. Exportada para tests.
 */
export function buildPickPrompt(
  shortlist: Map<MediaType, MediaItem[]>,
  scores: Map<string, number>,
  library: LibraryItem[],
  topGenres: string[],
  locale: string
): string {
  const langInstruction = locale === 'es'
    ? 'Responde SIEMPRE en español.'
    : 'Always respond in English.'

  const libraryLines = library
    .map((item) => {
      const parts = [`"${item.title}" (${item.type}${item.year ? `, ${item.year}` : ''})`]
      if (item.score) parts.push(`★${item.score}`)
      else if (item.status === 'completed') parts.push('completado')
      return `- ${parts.join(' ')}`
    })
    .join('\n')

  const genresLine = topGenres.length > 0
    ? `Géneros favoritos: ${topGenres.join(', ')}`
    : 'Sin géneros definidos aún.'

  const candidateBlocks = Array.from(shortlist.entries())
    .map(([type, items]) => {
      const lines = items
        .map((item) => {
          const year = item.year ? `, ${item.year}` : ''
          const genres = item.genres?.length ? item.genres.join(', ') : 'sin géneros'
          return `  - id: ${item.id} | "${item.title}"${year} | ${genres} | match ${scores.get(item.id) ?? 0}%`
        })
        .join('\n')
      return `${type}:\n${lines}`
    })
    .join('\n\n')

  return `${langInstruction}

Biblioteca del usuario (completados o mejor valorados):
${libraryLines}

${genresLine}

Candidatos disponibles, agrupados por tipo. El "match" es la afinidad YA
calculada entre ese título y la biblioteca del usuario:

${candidateBlocks}

Elige EXACTAMENTE UN título de CADA tipo listado arriba.

Reglas:
- Solo puedes elegir ids que aparezcan en la lista de candidatos. No inventes
  títulos ni ids: cualquier id que no esté en la lista se descarta.
- El % de match es el criterio PRINCIPAL: prioriza los valores altos. Puedes
  preferir uno de match algo menor solo si encaja claramente mejor con lo que
  el usuario ya disfruta, y en ese caso explícalo en "reason".
- "reason" es una frase corta (máx. 140 caracteres) dirigida al usuario,
  explicando por qué le va a gustar ESE título en concreto conectándolo con su
  biblioteca o sus géneros favoritos. Va en el idioma indicado arriba.
- NUNCA menciones el % de match ni ningún número de afinidad en "reason"
  (E-MATCH-SIN-BADGE): ese porcentaje es un criterio INTERNO y se retiró de
  toda la interfaz. Di QUÉ comparte con lo que ya disfruta ("misma comedia
  coral que X"), no cuánto puntúa.
- NUNCA hables de ESTA lista ni de cómo has elegido (E-AIREC-SIN-PROCESO). El
  usuario no ve los candidatos ni sabe que existe una selección: para él solo
  hay una recomendación. Prohibido "único disponible en la selección actual",
  "la única opción de este tipo", "el mejor de la lista" y cualquier variante.
  Si de un tipo solo hay un candidato, NO lo digas: habla del título en sí —su
  género, su tono, lo que ofrece— como si lo hubieras elegido entre mil.

Responde ÚNICAMENTE con JSON válido. Sin markdown, sin texto adicional:
{
  "picks": [
    { "id": "movie_550", "reason": "Comparte la crítica corporativa y el tono kafkiano de lo que más puntúas." }
  ]
}`
}

// ── La frase no puede delatar el proceso (E-AIREC-SIN-PROCESO) ──────────────
//
// Visto en Inicio: "Único cómic disponible en la selección actual." y "Único
// juego disponible en la selección actual.". El usuario no ve los candidatos ni
// sabe que hay una shortlist; para él eso es la IA confesando que no tenía nada
// mejor que ofrecer.
//
// La regla está en el prompt, pero el prompt NO BASTA y esto ya lo sabíamos:
// con E-MATCH-SIN-BADGE se le prohibió citar el % y el modelo siguió
// escribiendo "match de 73%". Una instrucción es una petición; esto es la
// comprobación. Misma política anti-falsos-positivos que el filtro NSFW: se
// buscan FRASES inequívocas, nunca palabras sueltas — "disponible" a secas es
// legítima ("disponible en streaming") y no dispara nada.
//
// Al detectarlo se cae SOLO la frase, no la elección: la card se queda con el
// título que el modelo eligió y la UI pinta el porqué localizado, que es el
// mismo camino que ya se usa cuando el modelo no responde.
// Los patrones se comparan contra el texto NORMALIZADO (minúsculas y sin
// diacríticos) porque `\b` de JavaScript es ASCII: `\bú` no casa NUNCA, así que
// un patrón como /\búnic[oa]\b/ sobre "única" está muerto y no se nota. Lo cazó
// un test; sin él habría sido otro placebo silencioso.
const REASON_LEAK_PATTERNS: RegExp[] = [
  // Cifras de afinidad (E-MATCH-SIN-BADGE), el caso que ya se escapó una vez.
  /\d\s*%/,
  // El proceso de selección, ES y EN.
  /seleccion actual/,
  /current selection/,
  /\bcandidat[oa]s?\b/,
  /\bunic[oa]\b[^.]{0,40}\bdisponible\b/,
  /\bonly\b[^.]{0,40}\bavailable\b/,
  /opciones disponibles/,
  /available options/,
  /\ben (?:la|esta) lista\b/,
  /\bin (?:the|this) list\b/,
]

/** Minúsculas y sin diacríticos, para que `\b` funcione sobre palabras acentuadas. */
function normalizeReason(reason: string): string {
  return reason
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** True si la frase habla del proceso o cita una cifra, en vez de hablar del título. */
export function reasonLeaksProcess(reason: string): boolean {
  const text = normalizeReason(reason)
  return REASON_LEAK_PATTERNS.some((re) => re.test(text))
}

/**
 * `id` → `reason` de la respuesta del modelo. Vacío si la respuesta no es
 * usable. Un id con `undefined` significa "el modelo lo eligió, pero su frase
 * delataba el proceso y se descartó": la elección se respeta, el texto no.
 */
function parsePicks(rawText: string): Map<string, string | undefined> {
  const chosen = new Map<string, string | undefined>()

  // El regex extrae el primer bloque {...}; el schema del prompt siempre pide un
  // objeto raíz, así que una respuesta con array raíz se descarta (→ fallback).
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return chosen

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { picks?: unknown }
    if (!Array.isArray(parsed.picks)) return chosen

    for (const pick of parsed.picks) {
      if (typeof pick !== 'object' || pick === null) continue
      const { id, reason } = pick as { id?: unknown; reason?: unknown }
      if (typeof id === 'string' && typeof reason === 'string' && reason.trim() !== '') {
        const text = reason.trim()
        if (reasonLeaksProcess(text)) {
          log.warn('Reason descartada: delataba el proceso', { id, reason: text })
          chosen.set(id, undefined)
        } else {
          chosen.set(id, text)
        }
      }
    }
  } catch (err) {
    log.error('Failed to parse Claude picks', { err })
  }

  return chosen
}

/**
 * Combina la elección del modelo con la shortlist real: por cada tipo se toma el
 * candidato que Claude eligió (validado contra ESA shortlist, así que un id
 * alucinado o de otro tipo no cuela) y, si no hay elección válida, el de mayor
 * match. Nunca devuelve un tipo con candidatos sin card.
 */
function resolvePicks(
  shortlist: Map<MediaType, MediaItem[]>,
  scores: Map<string, number>,
  chosen: Map<string, string | undefined>
): AiRec[] {
  const picks: AiRec[] = []
  Array.from(shortlist.values()).forEach((items) => {
    const picked = items.find((item) => chosen.has(item.id)) ?? items[0]
    if (!picked) return
    picks.push({
      item: picked,
      matchScore: scores.get(picked.id) ?? 0,
      reason: chosen.get(picked.id),
    })
  })
  return picks
}

/**
 * Recomendaciones de "Para ti": un título real de cada tipo, elegido por match y
 * explicado por Claude. Devuelve [] solo cuando no hay señal suficiente en la
 * biblioteca o ningún proveedor dio candidatos — nunca por un fallo del modelo.
 */
export async function getAiRecommendations(
  userId: string,
  topGenres: string[],
  locale: string = 'es',
  supabaseClient?: SupabaseClient
): Promise<AiRec[]> {
  const cacheKey = `${userId}:${locale}:${PROMPT_VERSION}`
  const supabase = supabaseClient ?? createClient()

  const library = await getLibraryContext(userId, supabase)

  // Sin contexto suficiente no hay perfil de gustos fiable: la UI pide al
  // usuario que añada títulos en vez de enseñar recomendaciones al azar.
  if (library.length < MIN_LIBRARY_ITEMS) return []

  const offset = rotationCounter.get(cacheKey) ?? 0
  rotationCounter.set(cacheKey, offset + 1)

  // Lo caro (barrer 7 catálogos + calcular match) se cachea; lo que cambia en
  // cada visita es QUÉ parte de esa shortlist se ofrece (E-AIREC-ROTACION).
  let entry = getCachedPool(cacheKey)
  if (!entry) {
    const owned = await getOwnedMediaIds(userId, supabase)
    // Al refrescar la shortlist se rota también la página del catálogo: si no,
    // los candidatos saldrían siempre del mismo puñado de títulos populares.
    const pools = await fetchCandidatePools(locale, owned, 1 + (offset % CATALOG_PAGES))
    const candidates = Array.from(pools.values()).flat()
    if (candidates.length === 0) return []

    // El match es el criterio de la recomendación: sin él (gate de señal mínima
    // de computeMatchScores) no hay nada por lo que ordenar ni que mostrar en
    // el badge.
    const scores = await computeMatchScores(userId, candidates, supabase, locale)
    if (scores.size === 0) return []

    entry = {
      shortlist: shortlistByType(pools, scores),
      scores,
      expiresAt: Date.now() + POOL_CACHE_TTL_MS,
    }
    poolCache.set(cacheKey, entry)
  }

  const windowed = rotateWindow(entry.shortlist, offset)
  const chosen = await chooseWithClaude(windowed, entry.scores, library, topGenres, locale)
  return resolvePicks(windowed, entry.scores, chosen)
}

/**
 * Pide a Claude que elija y explique. Cualquier fallo (sin clave, error de API,
 * respuesta no parseable) devuelve un mapa vacío → `resolvePicks` cae al de
 * mayor match de cada tipo y la sección sigue mostrando sus 7 cards.
 */
async function chooseWithClaude(
  shortlist: Map<MediaType, MediaItem[]>,
  scores: Map<string, number>,
  library: LibraryItem[],
  topGenres: string[],
  locale: string
): Promise<Map<string, string | undefined>> {
  // Opcional en el schema: graceful, degrada al orden por match si no está.
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    log.warn('ANTHROPIC_API_KEY not set — se recomienda solo por match, sin explicación')
    return new Map()
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: 'Eres un motor de recomendaciones de contenido cultural. Eliges ÚNICAMENTE entre los candidatos que se te dan y respondes ÚNICAMENTE con JSON válido, sin explicaciones ni texto adicional.',
      messages: [
        { role: 'user', content: buildPickPrompt(shortlist, scores, library, topGenres, locale) },
      ],
    })
    const block = message.content[0]
    if (block.type !== 'text') return new Map()
    return parsePicks(block.text)
  } catch (err) {
    log.error('Claude API error', { err })
    return new Map()
  }
}
