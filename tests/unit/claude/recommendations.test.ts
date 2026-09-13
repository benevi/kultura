// ============================================================
// KULTURA — buildPrompt + cache key unit tests (SPEC-040)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock de dependencias del módulo para que el import no falle en jsdom
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

// searchByType se mockea a nivel de módulo (hoisted) para que sobreviva a
// vi.resetModules() en los beforeEach. Cada test ajusta su valor de retorno.
const { searchByTypeMock } = vi.hoisted(() => ({ searchByTypeMock: vi.fn() }))
vi.mock('@/lib/api/search', () => ({ searchByType: searchByTypeMock }))

// ── buildPrompt ───────────────────────────────────────────────────────────────

describe('buildPrompt', () => {
  const mockItems = [
    { title: 'Inception', type: 'movie', year: 2010, score: 5, status: 'completed' },
    { title: 'Attack on Titan', type: 'anime', year: 2013, score: 4, status: 'completed' },
    { title: 'The Witcher 3', type: 'game', year: 2015, score: null, status: 'completed' },
  ]
  const mockGenres = ['Action', 'Fantasy']

  it('contains Spanish language instruction when locale is es', async () => {
    const { buildPrompt } = await import('@/lib/claude/recommendations')
    const prompt = buildPrompt(mockItems, mockGenres, 'es')
    expect(prompt).toContain('Responde SIEMPRE en español')
  })

  it('contains English language instruction when locale is en', async () => {
    const { buildPrompt } = await import('@/lib/claude/recommendations')
    const prompt = buildPrompt(mockItems, mockGenres, 'en')
    expect(prompt).toContain('Always respond in English')
  })

  it('contains diversity instruction limiting same type to 2', async () => {
    const { buildPrompt } = await import('@/lib/claude/recommendations')
    const prompt = buildPrompt(mockItems, mockGenres, 'es')
    expect(prompt).toContain('máximo 2 recomendaciones del mismo tipo')
  })

  it('contains few-shot example with searchQuery field', async () => {
    const { buildPrompt } = await import('@/lib/claude/recommendations')
    const prompt = buildPrompt(mockItems, mockGenres, 'es')
    expect(prompt).toContain('searchQuery')
    expect(prompt).toContain('"recommendations"')
  })
})

// ── Cache key: locale y versión ───────────────────────────────────────────────

describe('getAiRecommendations — cache key includes locale and version', () => {
  const LIBRARY_ITEMS = Array.from({ length: 5 }, (_, i) => ({
    status: 'completed',
    score: 4,
    media: { title: `Film ${i}`, type: 'movie', year: 2020 },
  }))

  const VALID_RESPONSE = JSON.stringify({
    recommendations: [
      { title: 'Severance', type: 'tv', year: 2022, reason: 'Great show' },
    ],
  })

  function makeSupabaseMock() {
    return {
      createClient: () => ({
        auth: { getUser: vi.fn() },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: LIBRARY_ITEMS, error: null }),
        }),
      }),
    }
  }

  function makeAnthropicMock(createFn: ReturnType<typeof vi.fn>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = vi.fn().mockImplementation(function(this: any) {
      this.messages = { create: createFn }
    })
    return { default: Ctor }
  }

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
  })

  afterEach(() => {
    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('different locales produce different cache keys (en → calls Anthropic again)', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: VALID_RESPONSE }],
    })

    searchByTypeMock.mockResolvedValue([])
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')

    await getAiRecommendations('u1', [], 'es')
    expect(createMock).toHaveBeenCalledTimes(1)

    await getAiRecommendations('u1', [], 'en')
    // Different locale = different cache key = new Anthropic call
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it('same locale hits cache on second call (no extra Anthropic call)', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: VALID_RESPONSE }],
    })

    searchByTypeMock.mockResolvedValue([])
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')

    await getAiRecommendations('u2', [], 'es')
    expect(createMock).toHaveBeenCalledTimes(1)

    await getAiRecommendations('u2', [], 'es')
    // Same key → cache hit → no second Anthropic call
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})

// ── resolveMediaRefs: id/posterUrl/mediaUrl (E66) ─────────────────────────────

describe('getAiRecommendations — resolves media refs via searchByType', () => {
  const LIBRARY_ITEMS = Array.from({ length: 5 }, (_, i) => ({
    status: 'completed',
    score: 4,
    media: { title: `Film ${i}`, type: 'movie', year: 2020 },
  }))

  function makeSupabaseMock() {
    return {
      createClient: () => ({
        auth: { getUser: vi.fn() },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: LIBRARY_ITEMS, error: null }),
        }),
      }),
    }
  }

  function makeAnthropicMock(createFn: ReturnType<typeof vi.fn>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = vi.fn().mockImplementation(function(this: any) {
      this.messages = { create: createFn }
    })
    return { default: Ctor }
  }

  beforeEach(() => {
    vi.resetModules()
    searchByTypeMock.mockReset()
    searchByTypeMock.mockResolvedValue([])
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
  })

  afterEach(() => {
    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('sets id/posterUrl/mediaUrl when searchByType resolves', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        recommendations: [
          { title: 'Severance', type: 'tv', year: 2022, reason: 'Great', searchQuery: 'Severance TV' },
        ],
      }) }],
    })
    searchByTypeMock.mockResolvedValue([
      { id: 'tv_95396', type: 'tv', title: 'Severance', poster: 'https://img/poster.jpg' },
    ])

    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-resolve', [], 'es')

    // E-TMDB-LOCALE: la resolución de la referencia usa el locale activo.
    expect(searchByTypeMock).toHaveBeenCalledWith('Severance TV', 'tv', 'es')
    expect(recs[0].id).toBe('tv_95396')
    expect(recs[0].posterUrl).toBe('https://img/poster.jpg')
    expect(recs[0].mediaUrl).toBe('/media/tv/tv_95396')
  })

  it('discards the recommendation entirely when searchByType returns no match (sin portada, sin card)', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        recommendations: [
          { title: 'Obscure', type: 'book', reason: 'x', searchQuery: 'Obscure book' },
        ],
      }) }],
    })
    searchByTypeMock.mockResolvedValue([])

    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-nomatch', [], 'es')

    // Sin match no hay portada que mostrar → se descarta, no cae a un card "vacío".
    expect(recs).toEqual([])
  })

  it('discards the recommendation when searchByType resolves a match without poster', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        recommendations: [
          { title: 'Obscure', type: 'book', reason: 'x', searchQuery: 'Obscure book' },
        ],
      }) }],
    })
    searchByTypeMock.mockResolvedValue([
      { id: 'book_1', type: 'book', title: 'Obscure', poster: undefined },
    ])

    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-noposter', [], 'es')

    expect(recs).toEqual([])
  })

  it('discards the match when the resolved year is far from the rec year (bad searchQuery false positive)', async () => {
    // Reproduce el bug real: la IA recomienda "Kirby y la Tierra Olvidada"
    // (2022) pero una searchQuery mal traducida hace que RAWG devuelva como
    // único resultado un juego sin relación de 2016 — no debe aceptarse solo
    // porque tiene póster.
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        recommendations: [
          { title: 'Kirby and the Forgotten Land', type: 'game', year: 2022, reason: 'x', searchQuery: 'Kirby y la Tierra Olvidada' },
        ],
      }) }],
    })
    searchByTypeMock.mockResolvedValue([
      { id: 'game_242708', type: 'game', title: 'NaN', year: 2016, poster: 'https://rawg/nan.jpg' },
    ])

    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-badmatch', [], 'es')

    expect(recs).toEqual([])
  })

  it('accepts the match when the resolved year is within ±1 of the rec year', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        recommendations: [
          { title: 'Kirby and the Forgotten Land', type: 'game', year: 2022, reason: 'x', searchQuery: 'Kirby and the Forgotten Land' },
        ],
      }) }],
    })
    searchByTypeMock.mockResolvedValue([
      { id: 'game_509903', type: 'game', title: 'Kirby and the Forgotten Land', year: 2022, poster: 'https://rawg/kirby.jpg' },
    ])

    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-goodmatch', [], 'es')

    expect(recs[0].id).toBe('game_509903')
    expect(recs[0].title).toBe('Kirby and the Forgotten Land')
    expect(recs[0].mediaUrl).toBe('/media/game/game_509903')
  })

  it('picks a later result whose year matches when the top result year does not', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        recommendations: [
          { title: 'Severance', type: 'tv', year: 2022, reason: 'x', searchQuery: 'Severance' },
        ],
      }) }],
    })
    searchByTypeMock.mockResolvedValue([
      { id: 'tv_1', type: 'tv', title: 'Severance (unrelated)', year: 1998, poster: 'https://img/wrong.jpg' },
      { id: 'tv_95396', type: 'tv', title: 'Severance', year: 2022, poster: 'https://img/right.jpg' },
    ])

    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-secondmatch', [], 'es')

    expect(recs[0].id).toBe('tv_95396')
    expect(recs[0].posterUrl).toBe('https://img/right.jpg')
  })

  it('does not set mediaUrl for comic (ficha not supported yet)', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        recommendations: [
          { title: 'Saga', type: 'comic', reason: 'x', searchQuery: 'Saga comic' },
        ],
      }) }],
    })
    searchByTypeMock.mockResolvedValue([
      { id: 'comic_123', type: 'comic', title: 'Saga', poster: 'https://cv/saga.jpg' },
    ])

    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-comic', [], 'es')

    expect(recs[0].posterUrl).toBe('https://cv/saga.jpg')
    expect(recs[0].id).toBe('comic_123')
    expect(recs[0].mediaUrl).toBeUndefined()
  })
})
