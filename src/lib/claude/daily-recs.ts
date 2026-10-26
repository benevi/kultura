// ============================================================
// KULTURA — Recomendaciones del día guardadas (D-06 / ROJO-4)
//
// "Para ti" se genera como mucho una vez por usuario y día y se reutiliza hasta
// el día siguiente. El idioma NO cuenta para ese límite: si el usuario cambia
// de idioma a mitad del día se le sirve lo guardado sin las frases del modelo
// (estaban en el otro idioma) y la UI pinta el porqué localizado a partir de
// los géneros, igual que cuando el modelo no responde. La respuesta se guarda en `ai_recs`
// (migración `20261023040001_ai_budget.sql`), que solo lee y escribe el
// servidor con la service-role key: RLS activa y ninguna política para
// usuarios, así que nadie puede leer las de otro ni fabricarse las suyas.
//
// Sin la migración (o con la base caída) se guarda en memoria de la instancia:
// una instancia nueva volvería a pagar, pero el tope global de `budget.ts`
// sigue mandando.
//
// Server-only: usa la service-role key.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { aiDay } from '@/lib/claude/budget'
import { createLogger } from '@/lib/logger'
import type { AiRec } from '@/lib/claude/recommendations'

const log = createLogger('claude/daily-recs')

/** Lo que recibe Inicio: las recomendaciones y de dónde salen. */
// `type` y no `interface` (como EpisodeProgress), aunque al guardarlo se pasa
// por JSON: `MediaItem.metadata` es `Record<string, unknown>`, que no es `Json`.
export type AiRecsResult = {
  recommendations: AiRec[]
  /** `ai` → el modelo eligió y explicó; `match` → orden por match, sin frase. */
  source: 'ai' | 'match'
  /** Solo presente (y `true`) cuando no se llamó al modelo por el tope diario. */
  capped?: true
  /**
   * Solo presente (y `false`) cuando la respuesta NO se guardó (el modelo
   * falló): no es "la de hoy" y el usuario puede volver a pedirla.
   */
  saved?: false
}

/** Lo guardado: el resultado y el idioma en que se generó. */
interface StoredRecs {
  locale: string
  result: AiRecsResult
}

const memory = new Map<string, StoredRecs>()
const MEMORY_MAX = 1000

function memoryKey(userId: string, day: string) {
  return `${userId}|${day}`
}

function remember(key: string, value: StoredRecs) {
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value
    if (oldest !== undefined) memory.delete(oldest)
  }
  memory.set(key, value)
}

/** Acepta solo filas con la forma esperada: una fila rara no rompe Inicio. */
function asResult(payload: unknown): AiRecsResult | null {
  if (typeof payload !== 'object' || payload === null) return null
  const { recommendations, source, capped } = payload as Record<string, unknown>
  if (!Array.isArray(recommendations)) return null
  if (source !== 'ai' && source !== 'match') return null
  const valid = recommendations.every(
    (rec) =>
      typeof rec === 'object' &&
      rec !== null &&
      typeof (rec as AiRec).item === 'object' &&
      (rec as AiRec).item !== null &&
      typeof (rec as AiRec).item.id === 'string'
  )
  if (!valid) return null
  return capped === true
    ? { recommendations: recommendations as AiRec[], source, capped: true }
    : { recommendations: recommendations as AiRec[], source }
}

/**
 * Adapta lo guardado al idioma pedido. Mismo idioma → tal cual. Otro idioma →
 * las mismas elecciones sin `reason` (la frase del modelo estaba en el otro
 * idioma); la UI pinta entonces el porqué localizado.
 */
function forLocale(stored: StoredRecs, locale: string): AiRecsResult {
  if (stored.locale === locale) return stored.result
  return {
    ...stored.result,
    recommendations: stored.result.recommendations.map((rec) => ({
      item: rec.item,
      matchScore: rec.matchScore,
    })),
  }
}

/**
 * Las recomendaciones de hoy del usuario, en cualquier idioma, adaptadas al
 * pedido (ver `forLocale`). Nunca lanza.
 */
export async function readDailyRecs(
  userId: string,
  locale: string,
  day: string = aiDay()
): Promise<AiRecsResult | null> {
  const key = memoryKey(userId, day)
  const inMemory = memory.get(key)
  if (inMemory) return forLocale(inMemory, locale)

  try {
    const { data, error } = await createAdminClient()
      .from('ai_recs')
      .select('locale, payload')
      .eq('user_id', userId)
      .eq('day', day)
      .maybeSingle()
    if (error || !data) return null
    const row = data as { locale?: unknown; payload?: unknown }
    const result = asResult(row.payload)
    if (!result || typeof row.locale !== 'string') return null
    const stored = { locale: row.locale, result }
    remember(key, stored)
    return forLocale(stored, locale)
  } catch {
    return null
  }
}

/** Guarda las de hoy. Un fallo aquí solo cuesta generarlas otra vez. Nunca lanza. */
export async function writeDailyRecs(
  userId: string,
  locale: string,
  result: AiRecsResult,
  day: string = aiDay()
): Promise<void> {
  // La memoria se escribe siempre y primero: aunque la tabla no exista, esta
  // instancia no vuelve a pagar hoy por el mismo usuario.
  remember(memoryKey(userId, day), { locale, result })
  try {
    const { error } = await createAdminClient()
      .from('ai_recs')
      .upsert(
        // Ida y vuelta por JSON: lo que se guarda es exactamente lo que vale como
        // jsonb (`metadata` de cada título es `Record<string, unknown>` y no
        // encaja en el tipo `Json`), sin cast.
        { user_id: userId, day, locale, payload: JSON.parse(JSON.stringify(result)) },
        { onConflict: 'user_id,day' }
      )
    if (error) {
      if (error.code !== '42P01' && error.code !== 'PGRST205') {
        log.warn('No se pudieron guardar las recomendaciones del día', { code: error.code })
      }
      return
    }
    // Minimización: solo hace falta la de hoy. Las de días anteriores del
    // mismo usuario se borran al guardar la nueva (una consulta indexada).
    await createAdminClient().from('ai_recs').delete().eq('user_id', userId).lt('day', day)
  } catch (err) {
    log.warn('No se pudieron guardar las recomendaciones del día', { err: String(err) })
  }
}
