// ============================================================
// KULTURA — Parseo de la respuesta del modelo (E-AIREC-CATALOG)
//
// Carga el módulo REAL @/lib/claude/recommendations para ejercer el parseo de
// verdad; solo se mockean las dependencias externas (Anthropic SDK, Supabase,
// catálogo y match).
//
// Invariante que cubre este archivo: una respuesta rota del modelo NUNCA deja la
// sección vacía. Los candidatos son reales y ya vienen ordenados por match, así
// que lo peor que puede pasar es servirlos sin explicación.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MediaItem, MediaType } from '@/types/media'

const { fetchDiscoverDataMock, computeMatchScoresMock } = vi.hoisted(() => ({
  fetchDiscoverDataMock: vi.fn(),
  computeMatchScoresMock: vi.fn(),
}))

vi.mock('@/lib/api/discover', () => ({ fetchDiscoverData: fetchDiscoverDataMock }))
vi.mock('@/lib/recommendations/match-score', () => ({
  computeMatchScores: computeMatchScoresMock,
}))

function makeItem(type: MediaType, externalId: string): MediaItem {
  return {
    id: `${type}_${externalId}`,
    externalId,
    type,
    title: `${type} ${externalId}`,
    poster: `https://img/${type}-${externalId}.jpg`,
    year: 2024,
    genres: ['Drama'],
  }
}

const LIBRARY_ROWS = Array.from({ length: 5 }, (_, i) => ({
  status: 'completed',
  score: 4,
  media: { title: `Movie ${i}`, type: 'movie', year: 2020 },
}))

// Dos candidatos de un solo tipo: 'best' tiene más match que 'second', así que
// el fallback por match es observable (siempre 'best').
const POOL = [makeItem('movie', 'best'), makeItem('movie', 'second')]
const SCORES: Record<string, number> = { movie_best: 90, movie_second: 30 }

function makeSupabaseMock(libraryRows: unknown[] = LIBRARY_ROWS) {
  return {
    createClient: () => ({
      auth: { getUser: vi.fn() },
      from: vi.fn(() => ({
        select: vi.fn((columns: string) => {
          if (columns === 'media_id') {
            return { eq: vi.fn().mockResolvedValue({ data: [], error: null }) }
          }
          const chain: Record<string, unknown> = {}
          chain.eq = vi.fn(() => chain)
          chain.or = vi.fn(() => chain)
          chain.order = vi.fn(() => chain)
          chain.limit = vi.fn().mockResolvedValue({ data: libraryRows, error: null })
          return chain
        }),
      })),
    }),
  }
}

function makeAnthropicMock(content: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = vi.fn().mockImplementation(function (this: any) {
    this.messages = { create: vi.fn().mockResolvedValue({ content }) }
  })
  return { default: Ctor }
}

function makeTextAnthropicMock(text: string) {
  return makeAnthropicMock([{ type: 'text', text }])
}

/** Ejecuta getAiRecommendations con la respuesta de modelo dada. */
async function runWithModelResponse(userId: string, text: string) {
  vi.doMock('@anthropic-ai/sdk', () => makeTextAnthropicMock(text))
  vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())
  const { getAiRecommendations } = await import('@/lib/claude/recommendations')
  return getAiRecommendations(userId, ['Drama'], 'es')
}

describe('getAiRecommendations — parseo de la respuesta del modelo', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchDiscoverDataMock.mockReset()
    fetchDiscoverDataMock.mockImplementation(async (type: string) => ({
      items: type === 'movie' ? POOL : [],
      totalPages: 1,
      hasMore: false,
      fetchErrorKind: null,
    }))
    computeMatchScoresMock.mockReset()
    computeMatchScoresMock.mockImplementation(async (_userId: string, items: MediaItem[]) =>
      new Map(items.map((item) => [item.id, SCORES[item.id] ?? 0]))
    )
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
  })

  afterEach(() => {
    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('respuesta válida → usa el pick y su explicación', async () => {
    const recs = await runWithModelResponse('p-ok', JSON.stringify({
      picks: [{ id: 'movie_second', reason: 'Más cercano a tus dramas favoritos.' }],
    }))

    expect(recs[0].item.id).toBe('movie_second')
    expect(recs[0].reason).toBe('Más cercano a tus dramas favoritos.')
  })

  it('JSON dentro de texto/markdown → se extrae el bloque igualmente', async () => {
    const recs = await runWithModelResponse(
      'p-markdown',
      'Aquí tienes:\n```json\n{"picks":[{"id":"movie_second","reason":"Vale."}]}\n```'
    )

    expect(recs[0].item.id).toBe('movie_second')
    expect(recs[0].reason).toBe('Vale.')
  })

  it('respuesta sin JSON → cae al de mayor match, sin explicación', async () => {
    const recs = await runWithModelResponse('p-nojson', 'No puedo ayudarte con eso.')

    expect(recs).toHaveLength(1)
    expect(recs[0].item.id).toBe('movie_best')
    expect(recs[0].reason).toBeUndefined()
  })

  it('JSON malformado → cae al de mayor match', async () => {
    const recs = await runWithModelResponse('p-broken', '{"picks":[{"id":"movie_second",}')

    expect(recs[0].item.id).toBe('movie_best')
    expect(recs[0].reason).toBeUndefined()
  })

  it('"picks" que no es array → cae al de mayor match', async () => {
    const recs = await runWithModelResponse('p-notarray', '{"picks":"movie_second"}')

    expect(recs[0].item.id).toBe('movie_best')
  })

  it('array raíz (sin objeto envolvente) → cae al de mayor match', async () => {
    const recs = await runWithModelResponse('p-rootarray', '[{"id":"movie_second","reason":"x"}]')

    expect(recs[0].item.id).toBe('movie_best')
  })

  it('pick con reason vacía se ignora → de mayor match y sin explicación', async () => {
    const recs = await runWithModelResponse('p-emptyreason', JSON.stringify({
      picks: [{ id: 'movie_second', reason: '   ' }],
    }))

    expect(recs[0].item.id).toBe('movie_best')
    expect(recs[0].reason).toBeUndefined()
  })

  it('pick con id no-string o entradas basura se ignoran sin romper el resto', async () => {
    const recs = await runWithModelResponse('p-garbage', JSON.stringify({
      picks: [null, 42, { id: 123, reason: 'ignorada' }, { id: 'movie_second', reason: 'válida' }],
    }))

    expect(recs[0].item.id).toBe('movie_second')
    expect(recs[0].reason).toBe('válida')
  })

  it('recorta los espacios de la explicación', async () => {
    const recs = await runWithModelResponse('p-trim', JSON.stringify({
      picks: [{ id: 'movie_second', reason: '  con espacios  ' }],
    }))

    expect(recs[0].reason).toBe('con espacios')
  })

  it('bloque de contenido no textual → cae al de mayor match', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock([{ type: 'tool_use', id: 'x', name: 'y', input: {} }]))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('p-nontext', ['Drama'], 'es')

    expect(recs).toHaveLength(1)
    expect(recs[0].item.id).toBe('movie_best')
    expect(recs[0].reason).toBeUndefined()
  })
})
