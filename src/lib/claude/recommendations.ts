// ============================================================
// KULTURA — AI Recommendations
// Genera recomendaciones personalizadas usando la biblioteca
// del usuario y sus géneros favoritos.
// Solo para uso server-side — GEMINI_API_KEY nunca al cliente.
// ============================================================

import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaType } from '@/types/media'

const PROMPT_VERSION = 'v2'

export interface AiRec {
  title: string
  type: MediaType
  year?: number
  reason: string
  searchQuery: string
}

interface LibraryItem {
  title: string
  type: string
  year: number | null
  score: number | null
  status: string
}

// ── Cache TTL en memoria ──────────────────────────────────────────────────────
// TTL: 1h. En multi-instancia de Vercel, migrar a KV/Redis.

const REC_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora

interface CacheEntry {
  data: AiRec[]
  expiresAt: number
}

const recCache = new Map<string, CacheEntry>()

function getCached(key: string): AiRec[] | null {
  const entry = recCache.get(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    recCache.delete(key)
    return null
  }
  return entry.data
}

function setCached(key: string, data: AiRec[]): void {
  recCache.set(key, { data, expiresAt: Date.now() + REC_CACHE_TTL_MS })
}

/** Invalida todas las entradas de caché de un usuario (todas las variantes de locale/versión). */
export function invalidateRecCache(userId: string): void {
  const prefix = `${userId}:`
  Array.from(recCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) recCache.delete(key)
  })
}

const VALID_TYPES: MediaType[] = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game']

function isValidType(t: unknown): t is MediaType {
  return typeof t === 'string' && (VALID_TYPES as string[]).includes(t)
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

/**
 * Construye el prompt para Claude con el historial del usuario.
 */
export function buildPrompt(items: LibraryItem[], topGenres: string[], locale: string): string {
  const langInstruction = locale === 'es'
    ? 'Responde SIEMPRE en español.'
    : 'Always respond in English.'

  const libraryLines = items
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

  return `${langInstruction}

Biblioteca del usuario (completados o mejor valorados):
${libraryLines}

${genresLine}

Recomienda exactamente 5 títulos que NO estén en la lista anterior y que el usuario probablemente disfrutaría.
Puedes recomendar películas, series, anime, libros, manga, cómics o videojuegos.
Incluye como máximo 2 recomendaciones del mismo tipo (movie, tv, anime, book, comic, manga, game).
Prioriza variedad: si el usuario solo ha consumido películas, recomiéndale también series, anime o libros.

Responde ÚNICAMENTE con JSON válido. Sin markdown, sin texto adicional. Ejemplo del formato exacto:
{
  "recommendations": [
    {
      "title": "Severance",
      "type": "tv",
      "year": 2022,
      "reason": "Comparte la atmósfera kafkiana y la crítica corporativa de las películas que te han gustado.",
      "searchQuery": "Severance TV series 2022"
    },
    {
      "title": "The Name of the Rose",
      "type": "book",
      "year": 1980,
      "reason": "Si disfrutaste El Nombre de la Rosa en película, la novela original profundiza mucho más.",
      "searchQuery": "The Name of the Rose Umberto Eco book"
    }
  ]
}`
}

/**
 * Llama al modelo de IA y devuelve recomendaciones parseadas.
 * Devuelve [] si la respuesta es inválida o la API falla.
 */
export async function getAiRecommendations(
  userId: string,
  topGenres: string[],
  locale: string = 'es',
  supabaseClient?: SupabaseClient
): Promise<AiRec[]> {
  const cacheKey = `${userId}:${locale}:${PROMPT_VERSION}`

  // Cache hit — evitar llamada a Gemini si los datos son recientes
  const cached = getCached(cacheKey)
  if (cached) return cached

  const items = await getLibraryContext(userId, supabaseClient)

  console.log('[AI-RECS DEBUG] library items:', items.length)

  // Mínimo 3 items para contexto útil
  if (items.length < 3) return []

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set')
    return []
  }

  const client = new GoogleGenAI({ apiKey })

  let rawText: string
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: buildPrompt(items, topGenres, locale),
      config: {
        maxOutputTokens: 1024,
        systemInstruction: 'Eres un motor de recomendaciones de contenido cultural. Respondes ÚNICAMENTE con JSON válido, sin explicaciones ni texto adicional.',
      },
    })

    console.log('[AI-RECS DEBUG] response keys:', Object.keys(response ?? {}))
    console.log('[AI-RECS DEBUG] response.text type:', typeof response.text)
    console.log('[AI-RECS DEBUG] response raw:', JSON.stringify(response).substring(0, 500))
    const text = response.text
    if (!text) {
      console.log('[AI-RECS DEBUG] response.text empty/undefined')
      return []
    }
    rawText = text
    console.log('[AI-RECS DEBUG] rawText:', rawText.substring(0, 200))
  } catch (err) {
    console.error('[AI-RECS DEBUG] Gemini API error:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
    return []
  }

  // Parsear y validar JSON
  // Nota: el regex extrae el primer bloque {...}. Si el modelo responde con un array
  // raíz ([{...}]) en lugar de un objeto, jsonMatch es null y se devuelve [].
  // El schema del prompt pide siempre un objeto, así que es poco probable.
  try {
    console.log('[AI-RECS DEBUG] rawText length:', rawText.length)
    console.log('[AI-RECS DEBUG] rawText full:', rawText)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    console.log('[AI-RECS DEBUG] jsonMatch found:', !!jsonMatch)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0]) as { recommendations?: unknown[] }
    console.log('[AI-RECS DEBUG] parsed ok, recs:', parsed.recommendations?.length)

    if (!Array.isArray(parsed.recommendations)) return []

    const currentYear = new Date().getFullYear()
    const results = parsed.recommendations
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .filter((r) => {
        const ok = typeof r.title === 'string' && r.title.trim() !== '' &&
          isValidType(r.type) &&
          typeof r.reason === 'string' && r.reason.trim() !== ''
        if (!ok) console.log('[AI-RECS DEBUG] item failed validation:', JSON.stringify(r))
        return ok
      })
      .slice(0, 5)
      .map((r) => ({
        title: (r.title as string).trim(),
        type: r.type as MediaType,
        year: typeof r.year === 'number' && r.year > 1800 && r.year <= currentYear + 5
          ? r.year : undefined,
        reason: (r.reason as string).trim(),
        searchQuery: encodeURIComponent((r.title as string).trim()),
      }))

    console.log('[AI-RECS DEBUG] results final:', results.length)
    setCached(cacheKey, results)
    return results
  } catch (err) {
    console.error('[AI-RECS DEBUG] parse error:', err)
    console.error('[AI-RECS DEBUG] rawText was:', rawText)
    return []
  }
}
