/**
 * KULTURA — Límite de peticiones
 *
 * Dos modos con la misma respuesta (`RateLimitResult`):
 *
 *  - `checkRateLimit` (síncrono): ventana deslizante en un `Map` de memoria de
 *    cada instancia. En Vercel una instancia caliente atiende muchas
 *    peticiones seguidas, así que frena al abusador lento; al que reparte la
 *    carga entre instancias (o espera a un arranque en frío) no (VERIF-A H8).
 *
 *  - `checkRateLimitDistributed` (asíncrono, D-21 / COD-6 / SEG-5): el mismo
 *    límite compartido entre TODAS las instancias, en Upstash Redis por su API
 *    REST (sin dependencia nueva). Si faltan las variables, o Redis no
 *    responde en `REDIS_TIMEOUT_MS`, cae al de memoria: un Redis caído nunca
 *    tumba la API, solo la deja con el límite débil de antes.
 *
 * Variables (las crea la integración de Upstash en Vercel; vale cualquiera de
 * las dos parejas):
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL        + KV_REST_API_TOKEN
 *
 * Las claves (que llevan la IP o el id de usuario) se guardan en Redis como
 * hash SHA-256 truncado: Redis solo ve un contador opaco que caduca en dos
 * ventanas.
 */

import { createLogger } from "@/lib/logger"

const log = createLogger("rate-limit")

interface WindowEntry {
  timestamps: number[]
}

// Store global en memoria — sobrevive entre peticiones dentro del mismo proceso
const store = new Map<string, WindowEntry>()

/**
 * A partir de este tamaño se barren las claves caducadas. Antes el `Map` no se
 * limpiaba nunca: con una IP distinta por petición crecía sin techo (COD C2).
 */
const STORE_SWEEP_THRESHOLD = 5_000
/** Ventana más larga de `LIMITS` (1 h): una entrada más vieja ya no cuenta. */
const STORE_MAX_WINDOW_MS = 60 * 60_000

export interface RateLimitOptions {
  /** Tamaño de la ventana en milisegundos */
  windowMs: number
  /** Máximo de peticiones permitidas en la ventana */
  max: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Segundos que el cliente debe esperar antes de reintentar */
  retryAfterSeconds: number
  remaining: number
}

function sweepStore(now: number): void {
  if (store.size < STORE_SWEEP_THRESHOLD) return
  store.forEach((entry, key) => {
    const last = entry.timestamps[entry.timestamps.length - 1]
    if (last === undefined || now - last > STORE_MAX_WINDOW_MS) store.delete(key)
  })
}

/**
 * Evalúa si `key` ha superado el límite de peticiones.
 * `key` debe ser `"{userId}:{route}"` o `"{ip}:{route}"` según el contexto.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const windowStart = now - opts.windowMs
  sweepStore(now)

  // Recuperar o inicializar entrada
  const entry = store.get(key) ?? { timestamps: [] }

  // Descartar timestamps fuera de la ventana (sliding)
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)

  if (entry.timestamps.length >= opts.max) {
    // Límite superado — calcular cuándo expira el timestamp más antiguo
    const oldest = entry.timestamps[0]
    const retryAfterMs = oldest + opts.windowMs - now
    store.set(key, entry)
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      remaining: 0,
    }
  }

  // Dentro del límite — registrar esta petición
  entry.timestamps.push(now)
  store.set(key, entry)

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: opts.max - entry.timestamps.length,
  }
}

/**
 * Limpia todas las entradas del store.
 * Solo para uso en tests.
 */
export function _resetStoreForTests(): void {
  store.clear()
  redisWarned = false
  redisDownUntil = 0
}

/** Número de claves en memoria. Solo para tests. */
export function _storeSizeForTests(): number {
  return store.size
}

// ── Redis por REST (Upstash) ──────────────────────────────────────────────────

/** Plazo de una llamada a Redis. Más allá, se usa el límite de memoria. */
export const REDIS_TIMEOUT_MS = 800

export interface RedisRestConfig {
  url: string
  token: string
}

/** Configuración de Upstash si está completa; `null` = modo memoria. */
export function redisRestConfig(): RedisRestConfig | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").trim()
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim()
  if (!url || !token || !/^https:\/\//i.test(url)) return null
  return { url: url.replace(/\/+$/, ""), token }
}

export type RedisCommand = (string | number)[]

/**
 * Ejecuta varios comandos en una sola petición (`/pipeline` de Upstash) y
 * devuelve sus resultados en orden. Lanza si Redis no responde a tiempo, si
 * la respuesta no es la esperada o si algún comando da error.
 *
 * POST con `cache: "no-store"`: la caché de datos de Next no debe guardar
 * nunca un contador.
 */
export async function redisPipeline(
  commands: RedisCommand[],
  cfg: RedisRestConfig | null = redisRestConfig()
): Promise<unknown[]> {
  if (!cfg) throw new Error("Redis no configurado")
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Redis REST ${res.status}`)
  const body = (await res.json()) as unknown
  if (!Array.isArray(body) || body.length !== commands.length) {
    throw new Error("Redis REST: respuesta inesperada")
  }
  return body.map((entry) => {
    const e = entry as { result?: unknown; error?: unknown } | null
    if (e && typeof e.error === "string") throw new Error(`Redis: ${e.error}`)
    return e?.result ?? null
  })
}

/** Hash corto y estable de la clave (no se guarda la IP en claro). */
export async function hashKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

let redisWarned = false

/**
 * Tras un fallo, Redis no se vuelve a probar en este tiempo: con Upstash
 * caído cada petición esperaría `REDIS_TIMEOUT_MS` para acabar en memoria.
 */
export const REDIS_RETRY_AFTER_MS = 30_000
let redisDownUntil = 0

/** ¿Se puede usar Redis ahora (configurado y sin un fallo reciente)? */
export function redisAvailable(now = Date.now()): RedisRestConfig | null {
  if (now < redisDownUntil) return null
  return redisRestConfig()
}

/** Anota un fallo de Redis: se deja de usar `REDIS_RETRY_AFTER_MS`. */
export function markRedisDown(now = Date.now()): void {
  redisDownUntil = now + REDIS_RETRY_AFTER_MS
}

function warnRedisOnce(e: unknown): void {
  if (redisWarned) return
  redisWarned = true
  const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  log.warn(`límite distribuido no disponible, se usa el de memoria · ${detail}`)
}

/**
 * Límite compartido entre instancias (D-21). Ventana deslizante aproximada
 * con dos cubos fijos (el patrón de Upstash Ratelimit): cuenta del cubo
 * actual + la del anterior ponderada por lo que queda de él dentro de la
 * ventana. Sin la ponderación, un cubo fijo deja pasar el doble en la frontera.
 *
 * Una petición rechazada también suma: quien insiste no consigue hueco antes.
 */
export async function checkRateLimitDistributed(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const now = Date.now()
  const cfg = redisAvailable(now)
  if (!cfg) return checkRateLimit(key, opts)

  const bucket = Math.floor(now / opts.windowMs)
  const elapsed = (now % opts.windowMs) / opts.windowMs

  try {
    const id = await hashKey(key)
    const current = `kultura:rl:${id}:${opts.windowMs}:${bucket}`
    const previous = `kultura:rl:${id}:${opts.windowMs}:${bucket - 1}`
    const [count, , prev] = await redisPipeline(
      [
        ["INCR", current],
        ["PEXPIRE", current, opts.windowMs * 2],
        ["GET", previous],
      ],
      cfg
    )
    const currentCount = Number(count)
    if (!Number.isFinite(currentCount)) throw new Error("Redis: INCR sin número")
    const previousCount = Number(prev ?? 0) || 0
    const estimate = currentCount + previousCount * (1 - elapsed)

    if (estimate > opts.max) {
      // Hasta que el peso del cubo anterior baje lo bastante, o, si el actual
      // ya basta para superar el límite, hasta que empiece el siguiente.
      const bucketEnd = (bucket + 1) * opts.windowMs
      let waitMs = bucketEnd - now
      if (previousCount > 0 && currentCount <= opts.max) {
        const needed = (estimate - opts.max) / previousCount
        waitMs = Math.min(waitMs, Math.ceil(needed * opts.windowMs))
      }
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        remaining: 0,
      }
    }
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, Math.floor(opts.max - estimate)),
    }
  } catch (e) {
    markRedisDown()
    warnRedisOnce(e)
    return checkRateLimit(key, opts)
  }
}

// ── Límites predefinidos por ruta ─────────────────────────────────────────────

export const LIMITS = {
  /** POST /api/library — 30 req/min por usuario */
  library: { windowMs: 60_000, max: 30 },
  /** POST /api/friends — 10 req/min por usuario */
  friends: { windowMs: 60_000, max: 10 },
  /** POST /api/recommendations — 10 req/min por usuario */
  recommendations: { windowMs: 60_000, max: 10 },
  /** POST /api/reports — 5 req/min por usuario */
  reports: { windowMs: 60_000, max: 5 },
  /** GET /api/search — 60 req/min por IP */
  search: { windowMs: 60_000, max: 60 },
  /** POST/DELETE /api/lists — 20 req/min por usuario */
  lists: { windowMs: 60_000, max: 20 },
  /** PATCH /api/notifications — 30 req/min por usuario */
  notifications: { windowMs: 60_000, max: 30 },
  /** POST /api/chat — crear conversación, 10/hora por usuario */
  chat_create: { windowMs: 60 * 60_000, max: 10 },
  /** POST /api/chat/[id] — enviar mensaje, 10/min por usuario */
  chat_message: { windowMs: 60_000, max: 10 },
  /** GET /api/chat/[id] — leer mensajes, 60/min por usuario */
  chat_read: { windowMs: 60_000, max: 60 },
  /** POST /api/groups — crear grupo, 5/hora por usuario */
  groups: { windowMs: 60 * 60_000, max: 5 },
  /** POST /api/suggestions — 3/hora por usuario */
  suggestions: { windowMs: 60 * 60_000, max: 3 },
  /** GET /api/users/search — 30/min por usuario o IP */
  users_search: { windowMs: 60_000, max: 30 },
  /** POST /api/groups/[id]/join — join/leave, 20/min por usuario */
  groups_join: { windowMs: 60_000, max: 20 },
  /** PATCH/DELETE /api/groups/invitations/[id] — aceptar/rechazar, 20/min por usuario */
  group_invitations: { windowMs: 60_000, max: 20 },
  /** PATCH /api/settings — actualizar perfil, 10/min por usuario */
  settings: { windowMs: 60_000, max: 10 },
  /** POST /api/auth/demo — entrar en la demo, 10/min por IP (E-DEMO) */
  demo_login: { windowMs: 60_000, max: 10 },
  /** DELETE /api/account — borrado de cuenta (D2), 3/hora por usuario — destructivo */
  account_delete: { windowMs: 60 * 60_000, max: 3 },
  /** GET /api/account/export — exportación de datos (D3), 5/hora por usuario */
  account_export: { windowMs: 60 * 60_000, max: 5 },
  /** POST /api/account/import — 5 req/hora por usuario (escribe en lote). */
  account_import: { windowMs: 60 * 60_000, max: 5 },
  /**
   * GET /api/discover — 120 req/min por IP (F-06, COD-6). Holgado para varias
   * personas tras la misma IP (CGNAT móvil, oficina, universidad) paginando y
   * filtrando; frena a un script que vacía los cupos de RAWG o ComicVine.
   */
  discover: { windowMs: 60_000, max: 120 },
} as const
