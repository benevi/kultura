// ============================================================
// KULTURA — getAiRecommendations parser y validación (E67)
// Carga el módulo REAL @/lib/claude/recommendations (sin mock del
// módulo) para ejercer el parsing/validación de verdad. Solo se
// mockean las dependencias externas: Anthropic SDK, Supabase y search.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// searchByType se mockea hoisted para sobrevivir a vi.resetModules().
// Devuelve [] por defecto → resolveMediaRefs deja id/posterUrl/mediaUrl undefined.
const { searchByTypeMock } = vi.hoisted(() => ({ searchByTypeMock: vi.fn() }))
vi.mock('@/lib/api/search', () => ({ searchByType: searchByTypeMock }))

// getLibraryContext espera filas anidadas { status, score, media: { title, type, year } }
// (ver recommendations.ts:96-103), no la forma plana.
const LIBRARY_ITEMS = Array.from({ length: 5 }, (_, i) => ({
  status: 'completed',
  score: 4,
  media: { title: `Movie ${i}`, type: 'movie', year: 2020 },
}))

function makeSupabaseMock(data: unknown[]) {
  return {
    createClient: () => ({
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function makeAnthropicMock(responseText: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = vi.fn().mockImplementation(function(this: any) {
    this.messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
      }),
    }
  })
  return { default: Ctor }
}

describe('getAiRecommendations — parser y validación', () => {
  beforeEach(() => {
    vi.resetModules()
    searchByTypeMock.mockReset()
    searchByTypeMock.mockResolvedValue([])
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('returns [] if library has fewer than 3 items', async () => {
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock(LIBRARY_ITEMS.slice(0, 2)))

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    expect(result).toEqual([])
  })

  it('filters recommendations with invalid type from Claude', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(JSON.stringify({
      recommendations: [
        { title: 'Valid Movie', type: 'movie', year: 2020, reason: 'Great film' },
        { title: 'Podcast Thing', type: 'podcast', year: 2021, reason: 'test' },
        { title: 'Music Album', type: 'music', year: 2022, reason: 'test' },
      ],
    })))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock(LIBRARY_ITEMS))

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    // Solo 'movie' pasa el filtro — 'podcast' y 'music' son tipos inválidos
    expect(result.map((r) => r.type)).toEqual(['movie'])
    expect(result[0].title).toBe('Valid Movie')
  })

  it('filters recommendations with empty title or reason', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(JSON.stringify({
      recommendations: [
        { title: 'Valid Movie', type: 'movie', year: 2020, reason: 'Great film' },
        { title: '', type: 'movie', year: 2020, reason: 'Has empty title' },
        { title: 'No reason movie', type: 'tv', year: 2020, reason: '' },
      ],
    })))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock(LIBRARY_ITEMS))

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    // Solo el item con title y reason no vacíos pasa
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Valid Movie')
  })

  it('returns [] if Claude returns malformed JSON', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock('Aquí tienes mis recomendaciones: no es JSON'))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock(LIBRARY_ITEMS))

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    expect(result).toEqual([])
  })

  it('clamps year to undefined if out of valid range', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(JSON.stringify({
      recommendations: [
        { title: 'Ancient Recs', type: 'movie', year: 1700, reason: 'Too old year' },
        { title: 'String Year', type: 'book', year: 'época medieval', reason: 'Non-numeric year' },
        { title: 'Valid Year', type: 'anime', year: 2010, reason: 'Good year' },
      ],
    })))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock(LIBRARY_ITEMS))

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const result = await getAiRecommendations('user-001', ['Drama'])
    // Los 3 items pasan los filtros de type/title/reason; solo cambia el año.
    expect(result).toHaveLength(3)
    // 1700 (< 1800) → undefined
    expect(result.find((r) => r.title === 'Ancient Recs')?.year).toBeUndefined()
    // string no numérico → undefined
    expect(result.find((r) => r.title === 'String Year')?.year).toBeUndefined()
    // 2010 válido → se conserva
    expect(result.find((r) => r.title === 'Valid Year')?.year).toBe(2010)
  })
})
