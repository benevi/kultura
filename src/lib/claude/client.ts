// ============================================================
// KULTURA — Cliente de Anthropic con tiempo y reintentos acotados
// (saneamiento 6.4)
//
// Por defecto el SDK espera hasta 10 minutos y reintenta 2 veces (408, 409,
// 429, 5xx y errores de red). Aquí las llamadas son cortas y alguien espera
// la respuesta, así que cada uso fija su tiempo y se reintenta una vez. El
// SDK reintenta también el timeout: el peor caso es timeout × (1 + reintentos).
// Un fallo ya degrada sin IA (recomendaciones por match, sinopsis original).
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

/** Tiempo por intento (ms) de cada uso. */
export const AI_TIMEOUT_MS = {
  /** Elegir y explicar recomendaciones: respuesta corta (1024 tokens). */
  recs: 15_000,
  /** Traducir una sinopsis (hasta 4096 tokens, en streaming). */
  translate: 30_000,
} as const

/** Reintentos tras el primer intento. */
export const AI_MAX_RETRIES = 1

export function anthropicClient(apiKey: string, use: keyof typeof AI_TIMEOUT_MS): Anthropic {
  return new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS[use], maxRetries: AI_MAX_RETRIES })
}
