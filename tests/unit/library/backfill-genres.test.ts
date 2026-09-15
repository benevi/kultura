// ============================================================
// KULTURA — E-MATCH-GENRES: autocurado de géneros de biblioteca
//
// Regresión del bug real: las filas de `media` cacheadas antes del 2026-09-12
// no guardaban `metadata.genres`, así que el perfil de gustos salía sin un solo
// género y TODAS las cards daban 0% MATCH (en todos los tipos, no solo los que
// dependían del catálogo de TMDB).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  needsGenreBackfill,
  fetchGenresForMedia,
  backfillGenres,
  type MediaGenreRow,
} from '@/lib/library/backfill-genres'

const { getMovieMock, getGameMock, getAnimeAniListMock } = vi.hoisted(() => ({
  getMovieMock: vi.fn(),
  getGameMock: vi.fn(),
  getAnimeAniListMock: vi.fn(),
}))

// Mocks PARCIALES: los normalizadores usan otros exports de estos módulos
// (tmdbPoster, toAniListRef…), así que sustituir el módulo entero los rompería.
vi.mock('@/lib/api/tmdb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tmdb')>()),
  getMovie: getMovieMock,
}))
vi.mock('@/lib/api/rawg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/rawg')>()),
  getGame: getGameMock,
}))
vi.mock('@/lib/api/anilist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/anilist')>()),
  getAnime: getAnimeAniListMock,
}))

/** Supabase mock que registra los update() sobre `media`. */
function makeSupabase(options: { updateFails?: boolean } = {}) {
  const updates: Array<{ id: string; metadata: Record<string, unknown> }> = []
  const client = {
    from: vi.fn(() => ({
      update: vi.fn((payload: { metadata: Record<string, unknown> }) => ({
        eq: vi.fn(async (_col: string, id: string) => {
          updates.push({ id, metadata: payload.metadata })
          return { error: options.updateFails ? { message: 'denied' } : null }
        }),
      })),
    })),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, updates }
}

function row(over: Partial<MediaGenreRow> = {}): MediaGenreRow {
  return { id: 'movie_1', type: 'movie', external_id: '1', metadata: null, ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('needsGenreBackfill', () => {
  it('metadata ausente o vacía → hay que reparar', () => {
    expect(needsGenreBackfill(null)).toBe(true)
    expect(needsGenreBackfill({})).toBe(true)
    expect(needsGenreBackfill({ genres: [] })).toBe(true)
  })

  it('con géneros ya cacheados → no se toca', () => {
    expect(needsGenreBackfill({ genres: ['Drama'] })).toBe(false)
  })

  it('sin géneros pero ya intentado → no se reintenta (cómics y similares)', () => {
    expect(needsGenreBackfill({ genres: [], genresSyncedAt: '2026-09-13T00:00:00Z' })).toBe(false)
  })
})

describe('fetchGenresForMedia', () => {
  it('movie: resuelve por TMDB', async () => {
    getMovieMock.mockResolvedValue({ id: 1, title: 'X', genres: [{ id: 28, name: 'Acción' }], vote_average: 7 })
    expect(await fetchGenresForMedia('movie', '550', 'es')).toEqual(['Acción'])
    expect(getMovieMock).toHaveBeenCalledWith(550, 'es')
  })

  it('game: resuelve por RAWG', async () => {
    getGameMock.mockResolvedValue({ id: 9, name: 'G', genres: [{ name: 'Platformer' }], rating: 4 })
    expect(await fetchGenresForMedia('game', '9', 'es')).toEqual(['Platformer'])
  })

  it('anime con id de AniList: usa AniList, no el Jikan legacy', async () => {
    getAnimeAniListMock.mockResolvedValue({
      id: 21, title: { romaji: 'One Piece' }, genres: ['Adventure'],
    })
    expect(await fetchGenresForMedia('anime', 'al-21', 'es')).toEqual(['Adventure'])
    expect(getAnimeAniListMock).toHaveBeenCalledWith(21)
  })

  it('comic: no hay género que pedir, devuelve vacío sin llamar a nadie', async () => {
    expect(await fetchGenresForMedia('comic', '4000-123', 'es')).toEqual([])
  })

  it('tipo desconocido → null (no se marca como reparado)', async () => {
    expect(await fetchGenresForMedia('podcast', '1', 'es')).toBeNull()
  })

  it('si el proveedor falla → null, nunca lanza', async () => {
    getMovieMock.mockRejectedValue(new Error('TMDB 500'))
    expect(await fetchGenresForMedia('movie', '550', 'es')).toBeNull()
  })
})

describe('backfillGenres', () => {
  it('repara la fila y la persiste con marca de sincronización', async () => {
    getMovieMock.mockResolvedValue({ id: 1, title: 'X', genres: [{ id: 18, name: 'Drama' }], vote_average: 7 })
    const { client, updates } = makeSupabase()

    const healed = await backfillGenres([row()], client, 'es')

    expect(healed.get('movie_1')).toEqual(['Drama'])
    expect(updates).toHaveLength(1)
    expect(updates[0].metadata.genres).toEqual(['Drama'])
    expect(updates[0].metadata.genresSyncedAt).toBeTruthy()
  })

  it('conserva el resto de metadata al reparar', async () => {
    getMovieMock.mockResolvedValue({ id: 1, title: 'X', genres: [{ id: 18, name: 'Drama' }], vote_average: 7 })
    const { client, updates } = makeSupabase()

    await backfillGenres([row({ metadata: { runtime: 120 } })], client, 'es')

    expect(updates[0].metadata.runtime).toBe(120)
  })

  it('no toca las filas que ya tienen géneros', async () => {
    const { client, updates } = makeSupabase()

    const healed = await backfillGenres([row({ metadata: { genres: ['Drama'] } })], client, 'es')

    expect(healed.size).toBe(0)
    expect(updates).toHaveLength(0)
    expect(getMovieMock).not.toHaveBeenCalled()
  })

  it('un proveedor caído deja esa fila sin curar y no rompe el resto', async () => {
    getMovieMock.mockRejectedValue(new Error('TMDB 500'))
    getGameMock.mockResolvedValue({ id: 9, name: 'G', genres: [{ name: 'Action' }], rating: 4 })
    const { client, updates } = makeSupabase()

    const healed = await backfillGenres(
      [row(), row({ id: 'game_9', type: 'game', external_id: '9' })],
      client,
      'es'
    )

    expect(healed.get('movie_1')).toBeUndefined()
    expect(healed.get('game_9')).toEqual(['Action'])
    expect(updates.map((u) => u.id)).toEqual(['game_9'])
  })

  it('si la escritura falla, los géneros se devuelven igual para esta carga', async () => {
    getMovieMock.mockResolvedValue({ id: 1, title: 'X', genres: [{ id: 18, name: 'Drama' }], vote_average: 7 })
    const { client } = makeSupabase({ updateFails: true })

    const healed = await backfillGenres([row()], client, 'es')

    expect(healed.get('movie_1')).toEqual(['Drama'])
  })

  it('acota el número de filas reparadas por ejecución', async () => {
    getMovieMock.mockResolvedValue({ id: 1, title: 'X', genres: [{ id: 18, name: 'Drama' }], vote_average: 7 })
    const { client, updates } = makeSupabase()

    const many = Array.from({ length: 40 }, (_, i) =>
      row({ id: `movie_${i}`, external_id: String(i) })
    )
    await backfillGenres(many, client, 'es')

    expect(updates.length).toBeLessThanOrEqual(25)
  })

  it('sin filas que reparar no llama a ningún proveedor', async () => {
    const { client } = makeSupabase()
    const healed = await backfillGenres([], client, 'es')
    expect(healed.size).toBe(0)
    expect(getMovieMock).not.toHaveBeenCalled()
  })
})
