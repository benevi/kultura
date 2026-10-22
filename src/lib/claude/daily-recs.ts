// ============================================================
// KULTURA — Recomendaciones del día guardadas (D-06 / ROJO-4)
//
// "Para ti" se genera como mucho una vez por usuario, día e idioma y se
// reutiliza hasta el día siguiente. La respuesta se guarda en `ai_recs`
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
export interface AiRecsResult {
  recommendations: AiRec[]
  /** `ai` → el modelo eligió y explicó; `match` → orden por match, sin frase. */
  source: 'ai' | 'match'
  /** Solo presente (y `true`) cuando no se llamó al modelo por el tope diario. */
  capped?: true
}

const memory = new Map<string, AiRecsResult>()
const MEMORY_MAX = 1000

function memoryKey(userId: string, day: string, locale: string) {
  return `${userId}|${day}|${locale}`
}

function remember(key: string, value: AiRecsResult) {
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

/** Las recomendaciones de hoy, si ya existen. Nunca lanza. */
export async function readDailyRecs(
  userId: string,
  locale: string,
  day: string = aiDay()
): Promise<AiRecsResult | null> {
  const key = memoryKey(userId, day, locale)
  const inMemory = memory.get(key)
  if (inMemory) return inMemory

  try {
    const { data, error } = await createAdminClient()
      .from('ai_recs')
      .select('payload')
      .eq('user_id', userId)
      .eq('day', day)
      .eq('locale', locale)
      .maybeSingle()
    if (error || !data) return null
    const result = asResult((data as { payload?: unknown }).payload)
    if (result) remember(key, result)
    return result
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
  remember(memoryKey(userId, day, locale), result)
  try {
    const { error } = await createAdminClient()
      .from('ai_recs')
      .upsert(
        { user_id: userId, day, locale, payload: result },
        { onConflict: 'user_id,day,locale' }
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
