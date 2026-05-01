// ============================================================
// KULTURA — buildPrompt + cache key unit tests (SPEC-040)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de dependencias del módulo para que el import no falle en jsdom
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

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
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  })

  it('different locales produce different cache keys (en → calls Anthropic again)', async () => {
    const createMock = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: VALID_RESPONSE }],
    })

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
