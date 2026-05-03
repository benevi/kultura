/**
 * KULTURA — Rate limiting middleware
 * Sliding window usando Map en memoria.
 * Apto para desarrollo y entornos single-instance.
 * En producción multi-instancia, reemplazar el store por Redis.
 */

interface WindowEntry {
  timestamps: number[]
}

// Store global en memoria — sobrevive entre peticiones dentro del mismo proceso
const store = new Map<string, WindowEntry>()

interface RateLimitOptions {
  /** Tamaño de la ventana en milisegundos */
  windowMs: number
  /** Máximo de peticiones permitidas en la ventana */
  max: number
}

interface RateLimitResult {
  allowed: boolean
  /** Segundos que el cliente debe esperar antes de reintentar */
  retryAfterSeconds: number
  remaining: number
}

/**
 * Evalúa si `key` ha superado el límite de peticiones.
 * `key` debe ser `"{userId}:{route}"` o `"{ip}:{route}"` según el contexto.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const windowStart = now - opts.windowMs

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
} as const
