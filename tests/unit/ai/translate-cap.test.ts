// ============================================================
// KULTURA — Las traducciones de sinopsis respetan el tope diario (D-06)
//
// `translateSynopsis` comparte el cupo `AI_DAILY_CALL_CAP` con las
// recomendaciones. Lo que ya está en caché (memoria o `media_translations`)
// NO consume cupo; solo la llamada real al modelo. Con el cupo agotado la
// sinopsis se sirve en su idioma original.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { streamMock, adminClientMock, rpcMock, cacheStore } = vi.hoisted(() => ({
  streamMock: vi.fn(),
  adminClientMock: vi.fn(),
  rpcMock: vi.fn(),
  cacheStore: new Map<string, string>(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { stream: streamMock }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: adminClientMock }))

const ENGLISH =
  'After a demon attack leaves his family slain and his sister cursed, a ' +
  'young man sets out on a journey to find a cure and to avenge the dead.'
const ENGLISH_2 =
  'A retired detective is pulled back into one last case when a string of ' +
  'murders starts to mirror the crimes he could never solve years ago.'
const SPANISH = 'Tras un ataque demoníaco que acaba con su familia, un joven emprende un viaje.'

function adminClient() {
  return {
    rpc: rpcMock,
    from: () => ({
      select: () => ({
        eq: (_col: string, key: string) => ({
          maybeSingle: async () => ({
            data: cacheStore.has(key) ? { content: cacheStore.get(key) } : null,
            error: null,
          }),
        }),
      }),
      upsert: async (row: { cache_key: string; content: string }) => {
        cacheStore.set(row.cache_key, row.content)
        return { error: null }
      },
    }),
  }
}

beforeEach(() => {
  vi.resetModules()
  streamMock.mockReset()
  rpcMock.mockReset()
  cacheStore.clear()
  adminClientMock.mockReset()
  adminClientMock.mockImplementation(adminClient)
  streamMock.mockReturnValue({ finalMessage: async () => ({ content: [{ type: 'text', text: SPANISH }] }) })
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
})

afterEach(() => vi.unstubAllEnvs())

describe('translateSynopsis — tope diario', () => {
  it('con el cupo agotado no llama al modelo y devuelve el original', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })
    const { translateSynopsis } = await import('@/lib/translate/synopsis')

    const out = await translateSynopsis({ text: ENGLISH, locale: 'es', mediaId: 'anime_al-1' })

    expect(out).toBe(ENGLISH)
    expect(streamMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledWith('increment_ai_usage', { p_kind: 'translate', p_cap: 100 })
  })

  it('con cupo, reserva una llamada y traduce', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null })
    const { translateSynopsis } = await import('@/lib/translate/synopsis')

    const out = await translateSynopsis({ text: ENGLISH, locale: 'es', mediaId: 'anime_al-1' })

    expect(out).toBe(SPANISH)
    expect(streamMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  it('lo que ya está en caché no gasta cupo', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null })
    const { translateSynopsis } = await import('@/lib/translate/synopsis')

    await translateSynopsis({ text: ENGLISH, locale: 'es', mediaId: 'anime_al-1' })
    await translateSynopsis({ text: ENGLISH, locale: 'es', mediaId: 'anime_al-1' })

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(streamMock).toHaveBeenCalledTimes(1)
  })

  it('un texto que ya está en el idioma pedido no gasta cupo', async () => {
    const { translateSynopsis } = await import('@/lib/translate/synopsis')
    await translateSynopsis({ text: SPANISH + ' Y encuentra a su hermana.', locale: 'es', mediaId: 'anime_al-2' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('cacheOnly nunca reserva cupo', async () => {
    const { translateSynopsis } = await import('@/lib/translate/synopsis')
    await translateSynopsis({ text: ENGLISH, locale: 'es', mediaId: 'anime_al-3', cacheOnly: true })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('sin la migración, el contador en memoria corta al llegar al tope', async () => {
    vi.stubEnv('AI_DAILY_CALL_CAP', '1')
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    const { translateSynopsis } = await import('@/lib/translate/synopsis')

    await translateSynopsis({ text: ENGLISH, locale: 'es', mediaId: 'anime_al-4' })
    const second = await translateSynopsis({ text: ENGLISH_2, locale: 'es', mediaId: 'anime_al-5' })

    expect(streamMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(ENGLISH_2)
  })
})
