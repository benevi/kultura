// ============================================================
// KULTURA — Tope diario de llamadas al modelo (D-06)
//
// Todo lo que llama a Anthropic (recomendaciones de "Para ti" y traducción de
// sinopsis) pasa antes por `reserveAiCall`. Es un único contador diario,
// compartido, con un techo en código: `AI_DAILY_CALL_CAP` (100 por defecto).
// Con Haiku 4.5 eso son unos céntimos al día y ~10 $/mes en el peor caso; el
// límite mensual de la consola de Anthropic queda como red, no como freno.
//
// Dónde vive el contador:
//   - Con la migración `20261023040001_ai_budget.sql` aplicada, en la tabla
//     `ai_usage` a través de `increment_ai_usage(kind, cap)`: atómica (un solo
//     UPDATE condicionado), compartida por todas las instancias.
//   - Sin ella (función o tabla inexistentes) o si la base no responde, en
//     memoria de la instancia. Es más laxo (cada instancia cuenta lo suyo),
//     pero nunca deja el grifo abierto.
//
// El día se cuenta en hora de Madrid, igual que en la función SQL, para que
// "hasta mañana" signifique lo mismo para el usuario y para el contador.
//
// Server-only: usa la service-role key.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'

const log = createLogger('claude/budget')

/** Qué consume la llamada. Solo sirve para desglosar el uso en `ai_usage`. */
export type AiCallKind = 'recs' | 'translate'

/** Llamadas al modelo por día para toda la app si el entorno no dice otra cosa. */
export const DEFAULT_AI_DAILY_CALL_CAP = 100

/** Zona horaria del "día" del contador (la misma que usa la función SQL). */
export const AI_DAY_TIME_ZONE = 'Europe/Madrid'

/**
 * Tope diario efectivo. `AI_DAILY_CALL_CAP=0` apaga la IA sin desplegar
 * código. Un valor ilegible o negativo cae al defecto: un error al escribir la
 * variable no puede convertirse en "sin límite".
 */
export function getAiDailyCallCap(): number {
  const raw = process.env.AI_DAILY_CALL_CAP?.trim()
  if (!raw) return DEFAULT_AI_DAILY_CALL_CAP
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_AI_DAILY_CALL_CAP
  return parsed
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AI_DAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Día `YYYY-MM-DD` en hora de Madrid. */
export function aiDay(now: Date = new Date()): string {
  return dayFormatter.format(now)
}

/**
 * Códigos que significan "la migración aún no está aplicada": tabla
 * inexistente (42P01), función inexistente (42883) o PostgREST sin la función
 * / tabla en su caché de esquema (PGRST202 / PGRST205). Solo se usan para no
 * llenar el log de avisos mientras tanto; el comportamiento es el mismo.
 */
const NOT_MIGRATED_CODES = new Set(['42P01', '42883', 'PGRST202', 'PGRST205'])

// ── Contador en memoria (respaldo) ────────────────────────────────────────────

let memoryDay = ''
let memoryCalls = 0

function reserveInMemory(cap: number): boolean {
  const today = aiDay()
  if (memoryDay !== today) {
    memoryDay = today
    memoryCalls = 0
  }
  if (memoryCalls >= cap) return false
  memoryCalls += 1
  return true
}

/**
 * Reserva UNA llamada al modelo del cupo de hoy. `true` → se puede llamar;
 * `false` → tope alcanzado, el llamante sirve su alternativa sin IA.
 *
 * Se reserva ANTES de llamar: si la llamada luego falla, el cupo ya está
 * gastado. Es a propósito: un proveedor que falla en bucle no puede convertir
 * los reintentos en gasto sin techo.
 *
 * Nunca lanza.
 */
export async function reserveAiCall(kind: AiCallKind): Promise<boolean> {
  const cap = getAiDailyCallCap()
  if (cap <= 0) return false

  try {
    const { data, error } = await createAdminClient().rpc('increment_ai_usage', {
      p_kind: kind,
      p_cap: cap,
    })
    if (!error) return data === true
    if (!NOT_MIGRATED_CODES.has(String(error.code))) {
      log.warn('increment_ai_usage falló; se cuenta en memoria', { code: error.code, kind })
    }
  } catch (err) {
    log.warn('increment_ai_usage no respondió; se cuenta en memoria', { err: String(err), kind })
  }

  return reserveInMemory(cap)
}
