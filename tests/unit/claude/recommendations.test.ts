// ============================================================
// KULTURA — Recomendaciones IA sobre catálogo real (E-AIREC-CATALOG)
//
// La función ya no inventa títulos: toma candidatos del MISMO pipeline que
// Descubrir (`fetchDiscoverData`), los ordena por match real
// (`computeMatchScores`) y deja que Claude elija uno por tipo. Estos tests
// cubren ese contrato: un ítem real por tipo, ids intactos (la ficha se enlaza
// con `externalId`) y degradación por match cuando el modelo no responde.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MediaItem, MediaType } from '@/types/media'

// Mocks hoisted para sobrevivir a vi.resetModules() en cada beforeEach.
const { fetchDiscoverDataMock, computeMatchScoresMock } = vi.hoisted(() => ({
  fetchDiscoverDataMock: vi.fn(),
  computeMatchScoresMock: vi.fn(),
}))

vi.mock('@/lib/api/discover', () => ({ fetchDiscoverData: fetchDiscoverDataMock }))
vi.mock('@/lib/recommendations/match-score', () => ({
  computeMatchScores: computeMatchScoresMock,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALL_TYPES: MediaType[] = ['movie', 'tv', 'anime', 'book', 'manga', 'comic', 'game']

function makeItem(type: MediaType, externalId: string, over: Partial<MediaItem> = {}): MediaItem {
  return {
    id: `${type}_${externalId}`,
    externalId,
    type,
    title: `${type} ${externalId}`,
    poster: `https://img/${type}-${externalId}.jpg`,
    year: 2024,
    genres: ['Action'],
    ...over,
  }
}

/** Biblioteca con señal suficiente (>= 3 items) para pasar el gate. */
const LIBRARY_ROWS = Array.from({ length: 5 }, (_, i) => ({
  status: 'completed',
  score: 4,
  media: { title: `Film ${i}`, type: 'movie', year: 2020 },
}))

/**
 * Supabase mock que atiende las DOS consultas del módulo, distinguiéndolas por
 * las columnas pedidas: `media_id` → ids en biblioteca (getOwnedMediaIds);
 * el resto → contexto de biblioteca (getLibraryContext, cadena .eq/.or/.order/.limit).
 */
function makeSupabaseMock(
  libraryRows: unknown[] = LIBRARY_ROWS,
  ownedRows: Array<{ media_id: string }> = []
) {
  return {
    createClient: () => ({
      auth: { getUser: vi.fn() },
      from: vi.fn(() => ({
        select: vi.fn((columns: string) => {
          if (columns === 'media_id') {
            return { eq: vi.fn().mockResolvedValue({ data: ownedRows, error: null }) }
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

function makeAnthropicMock(createFn: ReturnType<typeof vi.fn>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = vi.fn().mockImplementation(function (this: any) {
    this.messages = { create: createFn }
  })
  return { default: Ctor }
}

function claudeReturning(text: string) {
  return vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] })
}

/** `fetchDiscoverData` devuelve los candidatos de cada tipo según el mapa dado. */
function withPools(pools: Partial<Record<MediaType, MediaItem[]>>) {
  fetchDiscoverDataMock.mockImplementation(async (type: string) => ({
    items: pools[type as MediaType] ?? [],
    totalPages: 1,
    hasMore: false,
    fetchErrorKind: null,
  }))
}

/** Un candidato por tipo, todos con el mismo match. */
function onePerType(): Partial<Record<MediaType, MediaItem[]>> {
  return Object.fromEntries(ALL_TYPES.map((type) => [type, [makeItem(type, '1')]]))
}

/** Match score derivado del id, vía tabla; por defecto 50. */
function withScores(byId: Record<string, number> = {}) {
  computeMatchScoresMock.mockImplementation(async (_userId: string, items: MediaItem[]) =>
    new Map(items.map((item) => [item.id, byId[item.id] ?? 50]))
  )
}

// ── buildPickPrompt ───────────────────────────────────────────────────────────

describe('buildPickPrompt', () => {
  const library = [{ title: 'Inception', type: 'movie', year: 2010, score: 5, status: 'completed' }]

  async function build(locale: string) {
    const { buildPickPrompt } = await import('@/lib/claude/recommendations')
    const shortlist = new Map<MediaType, MediaItem[]>([
      ['movie', [makeItem('movie', '550'), makeItem('movie', '551')]],
      ['game', [makeItem('game', '667657')]],
    ])
    const scores = new Map([
      ['movie_550', 82],
      ['movie_551', 40],
      ['game_667657', 71],
    ])
    return buildPickPrompt(shortlist, scores, library, ['Action'], locale)
  }

  it('instrucción de idioma según locale', async () => {
    expect(await build('es')).toContain('Responde SIEMPRE en español')
    expect(await build('en')).toContain('Always respond in English')
  })

  it('lista cada candidato con su id exacto y su match', async () => {
    const prompt = await build('es')
    expect(prompt).toContain('id: movie_550')
    expect(prompt).toContain('match 82%')
    expect(prompt).toContain('id: game_667657')
    expect(prompt).toContain('match 71%')
  })

  it('pide exactamente uno de cada tipo y prohíbe inventar ids', async () => {
    const prompt = await build('es')
    expect(prompt).toContain('UN título de CADA tipo')
    expect(prompt).toContain('No inventes')
  })

  it('incluye el contexto de biblioteca y los géneros favoritos', async () => {
    const prompt = await build('es')
    expect(prompt).toContain('Inception')
    expect(prompt).toContain('Géneros favoritos: Action')
  })
})

// ── getAiRecommendations ──────────────────────────────────────────────────────

describe('getAiRecommendations', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchDiscoverDataMock.mockReset()
    computeMatchScoresMock.mockReset()
    withPools(onePerType())
    withScores()
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
  })

  afterEach(() => {
    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('devuelve una recomendación de CADA tipo (movie, tv, anime, book, manga, comic, game)', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-all-types', [], 'es')

    expect(recs.map((r) => r.item.type)).toEqual(ALL_TYPES)
  })

  it('la card lleva el ítem real: externalId SIN prefijo (la ficha hace Number(id) sobre él)', async () => {
    withPools({ ...onePerType(), game: [makeItem('game', '667657')] })
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-extid', [], 'es')

    const game = recs.find((r) => r.item.type === 'game')!
    // El id prefijado era justo el bug: /media/game/game_667657 → Number(...) = NaN.
    expect(game.item.externalId).toBe('667657')
    expect(game.item.id).toBe('game_667657')
  })

  it('expone el match real de cada pick', async () => {
    withPools({ movie: [makeItem('movie', '550')] })
    withScores({ movie_550: 91 })
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-score', [], 'es')

    expect(recs[0].matchScore).toBe(91)
  })

  it('respeta la elección de Claude y su explicación cuando el id es de esa shortlist', async () => {
    withPools({ movie: [makeItem('movie', 'a'), makeItem('movie', 'b')] })
    withScores({ movie_a: 80, movie_b: 60 })
    const createMock = claudeReturning(JSON.stringify({
      picks: [{ id: 'movie_b', reason: 'Encaja mejor con tus thrillers recientes.' }],
    }))
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-pick', [], 'es')

    // Elige el de match menor porque lo justifica — esa es la aportación del modelo.
    expect(recs[0].item.id).toBe('movie_b')
    expect(recs[0].reason).toBe('Encaja mejor con tus thrillers recientes.')
  })

  it('un id alucinado por Claude se descarta y cae al de mayor match del tipo', async () => {
    withPools({ movie: [makeItem('movie', 'a'), makeItem('movie', 'b')] })
    withScores({ movie_a: 80, movie_b: 60 })
    const createMock = claudeReturning(JSON.stringify({
      picks: [{ id: 'movie_inventado', reason: 'no existe' }],
    }))
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-halluc', [], 'es')

    expect(recs[0].item.id).toBe('movie_a')
    expect(recs[0].reason).toBeUndefined()
  })

  it('ordena los candidatos de cada tipo por match antes de elegir', async () => {
    withPools({ movie: [makeItem('movie', 'low'), makeItem('movie', 'high')] })
    withScores({ movie_low: 12, movie_high: 88 })
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-rank', [], 'es')

    expect(recs[0].item.id).toBe('movie_high')
  })

  it('sin ANTHROPIC_API_KEY sigue recomendando por match (sin explicación), no vacío', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    withPools({ movie: [makeItem('movie', 'a')] })
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-nokey', [], 'es')

    expect(recs).toHaveLength(1)
    expect(recs[0].item.id).toBe('movie_a')
    expect(recs[0].reason).toBeUndefined()
  })

  it('si la API de Claude falla sigue recomendando por match', async () => {
    withPools({ movie: [makeItem('movie', 'a')] })
    const createMock = vi.fn().mockRejectedValue(new Error('503 overloaded'))
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-apifail', [], 'es')

    expect(recs).toHaveLength(1)
    expect(recs[0].reason).toBeUndefined()
  })

  it('excluye lo que el usuario ya tiene en biblioteca', async () => {
    withPools({ movie: [makeItem('movie', 'owned'), makeItem('movie', 'new')] })
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () =>
      makeSupabaseMock(LIBRARY_ROWS, [{ media_id: 'movie_owned' }])
    )

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-owned', [], 'es')

    expect(recs.map((r) => r.item.id)).toEqual(['movie_new'])
  })

  it('descarta candidatos sin portada (no hay card que pintar)', async () => {
    withPools({
      movie: [makeItem('movie', 'sinposter', { poster: undefined }), makeItem('movie', 'conposter')],
    })
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-poster', [], 'es')

    expect(recs.map((r) => r.item.id)).toEqual(['movie_conposter'])
  })

  it('un proveedor caído deja su tipo sin card, no tumba el resto', async () => {
    fetchDiscoverDataMock.mockImplementation(async (type: string) =>
      type === 'game'
        ? { items: [], totalPages: 1, hasMore: false, fetchErrorKind: 'generic' }
        : { items: [makeItem(type as MediaType, '1')], totalPages: 1, hasMore: false, fetchErrorKind: null }
    )
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    const recs = await getAiRecommendations('u-provider-down', [], 'es')

    expect(recs.map((r) => r.item.type)).toEqual(['movie', 'tv', 'anime', 'book', 'manga', 'comic'])
  })

  it('biblioteca con menos de 3 items → [] (sin perfil de gustos fiable)', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock(LIBRARY_ROWS.slice(0, 2)))

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    expect(await getAiRecommendations('u-small', [], 'es')).toEqual([])
  })

  it('sin match calculable (gate de señal de computeMatchScores) → []', async () => {
    computeMatchScoresMock.mockResolvedValue(new Map())
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    expect(await getAiRecommendations('u-nosignal', [], 'es')).toEqual([])
  })

  it('ningún proveedor con candidatos → [] sin llamar a Claude', async () => {
    withPools({})
    const createMock = claudeReturning('{"picks":[]}')
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    expect(await getAiRecommendations('u-nocandidates', [], 'es')).toEqual([])
    expect(createMock).not.toHaveBeenCalled()
  })

  it('los candidatos se piden con el locale activo (catálogo localizado)', async () => {
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(claudeReturning('{"picks":[]}')))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    await getAiRecommendations('u-locale', [], 'en')

    expect(fetchDiscoverDataMock).toHaveBeenCalledWith('movie', 1, {}, 'en')
  })
})

// ── Cache ─────────────────────────────────────────────────────────────────────

describe('getAiRecommendations — cache por usuario/locale/versión', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchDiscoverDataMock.mockReset()
    computeMatchScoresMock.mockReset()
    withPools(onePerType())
    withScores()
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-key')
  })

  afterEach(() => {
    vi.doUnmock('@anthropic-ai/sdk')
    vi.doUnmock('@/lib/supabase/server')
    vi.unstubAllEnvs()
  })

  it('mismo locale → cache hit (sin segunda llamada a Claude)', async () => {
    const createMock = claudeReturning('{"picks":[]}')
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    await getAiRecommendations('u-cache', [], 'es')
    await getAiRecommendations('u-cache', [], 'es')

    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('locale distinto → clave distinta → se vuelve a generar', async () => {
    const createMock = claudeReturning('{"picks":[]}')
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations } = await import('@/lib/claude/recommendations')
    await getAiRecommendations('u-cache2', [], 'es')
    await getAiRecommendations('u-cache2', [], 'en')

    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it('invalidateRecCache borra las entradas del usuario', async () => {
    const createMock = claudeReturning('{"picks":[]}')
    vi.doMock('@anthropic-ai/sdk', () => makeAnthropicMock(createMock))
    vi.doMock('@/lib/supabase/server', () => makeSupabaseMock())

    const { getAiRecommendations, invalidateRecCache } = await import('@/lib/claude/recommendations')
    await getAiRecommendations('u-inv', [], 'es')
    invalidateRecCache('u-inv')
    await getAiRecommendations('u-inv', [], 'es')

    expect(createMock).toHaveBeenCalledTimes(2)
  })
})
