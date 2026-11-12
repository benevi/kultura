// ============================================================
// Saneamiento 6.4: el cliente de Anthropic sale con tiempo y reintentos
// acotados (el SDK espera hasta 10 min y reintenta 2 veces por defecto).
// ============================================================

import { describe, it, expect, vi } from 'vitest'

const ctor = vi.hoisted(() => vi.fn())
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor(opts: unknown) {
      ctor(opts)
    }
  },
}))

import { AI_MAX_RETRIES, AI_TIMEOUT_MS, anthropicClient } from '@/lib/claude/client'

describe('anthropicClient', () => {
  it('fija timeout por uso y un reintento', () => {
    anthropicClient('k', 'recs')
    anthropicClient('k', 'translate')
    expect(ctor).toHaveBeenNthCalledWith(1, { apiKey: 'k', timeout: AI_TIMEOUT_MS.recs, maxRetries: AI_MAX_RETRIES })
    expect(ctor).toHaveBeenNthCalledWith(2, { apiKey: 'k', timeout: AI_TIMEOUT_MS.translate, maxRetries: AI_MAX_RETRIES })
  })

  it('peor caso acotado: timeout × (1 + reintentos) por debajo de un minuto', () => {
    expect(AI_MAX_RETRIES).toBe(1)
    for (const ms of Object.values(AI_TIMEOUT_MS)) expect(ms * (1 + AI_MAX_RETRIES)).toBeLessThanOrEqual(60_000)
  })
})
