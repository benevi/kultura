// ============================================================
// KULTURA — Tope diario de llamadas al modelo (D-06)
//
// `reserveAiCall` es la única puerta hacia Anthropic: recomendaciones y
// traducciones comparten el mismo contador diario. Con la migración aplicada
// el contador vive en `ai_usage` (función `increment_ai_usage`, atómica); sin
// ella, en memoria de la instancia. En los dos casos, al llegar al tope se
// responde `false` y nadie llama al modelo.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { adminClientMock } = vi.hoisted(() => ({ adminClientMock: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: adminClientMock }))

/** Cliente admin cuyo `rpc` responde lo que se le diga. */
function adminWithRpc(rpc: ReturnType<typeof vi.fn>) {
  adminClientMock.mockImplementation(() => ({ rpc }))
}

/** Error de PostgREST cuando la función todavía no existe (migración sin aplicar). */
const NOT_MIGRATED = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }

async function load() {
  return import('@/lib/claude/budget')
}

beforeEach(() => {
  vi.resetModules()
  adminClientMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('getAiDailyCallCap', () => {
  it('por defecto 100 llamadas al día', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '')
    const { getAiDailyCallCap, DEFAULT_AI_DAILY_CALL_CAP } = await load()
    expect(DEFAULT_AI_DAILY_CALL_CAP).toBe(100)
    expect(getAiDailyCallCap()).toBe(100)
  })

  it('se puede bajar (o apagar con 0) desde el entorno', async () => {
    const { getAiDailyCallCap } = await load()
    vi.stubEnv('AI_DAILY_CALL_CAP', '7')
    expect(getAiDailyCallCap()).toBe(7)
    vi.stubEnv('AI_DAILY_CALL_CAP', '0')
    expect(getAiDailyCallCap()).toBe(0)
  })

  it('un valor no numérico o negativo no abre el grifo: vuelve al defecto', async () => {
    const { getAiDailyCallCap } = await load()
    vi.stubEnv('AI_DAILY_CALL_CAP', 'mucho')
    expect(getAiDailyCallCap()).toBe(100)
    vi.stubEnv('AI_DAILY_CALL_CAP', '-5')
    expect(getAiDailyCallCap()).toBe(100)
  })
})

describe('aiDay', () => {
  it('cuenta el día en hora de Madrid (00:30 en Madrid ya es el día siguiente)', async () => {
    const { aiDay } = await load()
    // 22:30 UTC del 22 de octubre = 00:30 del 23 en Madrid (CEST, UTC+2).
    expect(aiDay(new Date('2026-10-22T22:30:00Z'))).toBe('2026-10-23')
    expect(aiDay(new Date('2026-10-22T12:00:00Z'))).toBe('2026-10-22')
  })
})

describe('reserveAiCall — con la migración aplicada', () => {
  it('pide la reserva a increment_ai_usage con el tipo y el tope', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    adminWithRpc(rpc)
    const { reserveAiCall } = await load()

    expect(await reserveAiCall('recs')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('increment_ai_usage', { p_kind: 'recs', p_cap: 100 })
  })

  it('la base dice que se llegó al tope → false', async () => {
    adminWithRpc(vi.fn().mockResolvedValue({ data: false, error: null }))
    const { reserveAiCall } = await load()
    expect(await reserveAiCall('translate')).toBe(false)
  })

  it('con el tope a 0 ni siquiera pregunta a la base', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '0')
    const rpc = vi.fn()
    adminWithRpc(rpc)
    const { reserveAiCall } = await load()
    expect(await reserveAiCall('recs')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('reserveAiCall — sin la migración (contador en memoria)', () => {
  it('cuenta en memoria y corta al llegar al tope, compartido entre tipos', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '3')
    adminWithRpc(vi.fn().mockResolvedValue(NOT_MIGRATED))
    const { reserveAiCall } = await load()

    expect(await reserveAiCall('recs')).toBe(true)
    expect(await reserveAiCall('translate')).toBe(true)
    expect(await reserveAiCall('recs')).toBe(true)
    // Cuarta del día: da igual el tipo, el tope es uno solo.
    expect(await reserveAiCall('translate')).toBe(false)
    expect(await reserveAiCall('recs')).toBe(false)
  })

  it('el contador en memoria se reinicia al cambiar de día', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '1')
    adminWithRpc(vi.fn().mockResolvedValue(NOT_MIGRATED))
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T10:00:00Z'))
    const { reserveAiCall } = await load()

    expect(await reserveAiCall('recs')).toBe(true)
    expect(await reserveAiCall('recs')).toBe(false)

    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'))
    expect(await reserveAiCall('recs')).toBe(true)
  })

  it('si la base no responde (lanza) también se protege con la memoria', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '1')
    adminWithRpc(vi.fn().mockRejectedValue(new Error('fetch failed')))
    const { reserveAiCall } = await load()

    expect(await reserveAiCall('recs')).toBe(true)
    expect(await reserveAiCall('recs')).toBe(false)
  })
})
