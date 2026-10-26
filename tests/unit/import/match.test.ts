// @vitest-environment node
// F-26 — Emparejado en el servidor por cada vía (tmdb, IMDb, TVDB, MAL, ISBN,
// título + año / autor), con presupuesto y proveedores caídos.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ImportItem } from '@/lib/import/types'
import {
  ANILIST_BY_MAL,
  JIKAN_ANIME_5114,
  OPENLIBRARY_ISBN_HUNGER_GAMES,
  OPENLIBRARY_TITLE_DUNE,
  TMDB_FIND_EMPTY,
  TMDB_FIND_IMDB_FIGHT_CLUB,
  TMDB_FIND_TVDB_BREAKING_BAD,
  tmdbMovie,
  tmdbSearch,
} from './fixtures/providers'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  searchMovies: vi.fn(),
  searchTV: vi.fn(),
  searchOL: vi.fn(),
  searchOLTitle: vi.fn(),
  jikanAnime: vi.fn(),
  jikanManga: vi.fn(),
  providerFetch: vi.fn(),
}))

vi.mock('@/lib/api/tmdb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tmdb')>()),
  findByExternalId: mocks.find,
  searchMovies: mocks.searchMovies,
  searchTV: mocks.searchTV,
}))
vi.mock('@/lib/api/openlibrary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/openlibrary')>()),
  searchOpenLibrary: mocks.searchOL,
  searchOpenLibraryByTitle: mocks.searchOLTitle,
}))
vi.mock('@/lib/api/jikan', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/jikan')>()),
  getAnime: mocks.jikanAnime,
  getManga: mocks.jikanManga,
}))
vi.mock('@/lib/api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/http')>()),
  providerFetch: mocks.providerFetch,
}))

import { matchItems } from '@/lib/import/server/match'
import { ProviderBudget } from '@/lib/import/server/budget'
import { ProviderError, resetProviderCircuits } from '@/lib/api/http'

const item = (over: Partial<ImportItem>): ImportItem => ({
  key: '0',
  kind: 'movie',
  title: 'X',
  status: 'completed',
  rating10: null,
  watchedAt: null,
  ...over,
})

const ctx = (maxCalls = 100) => ({
  budget: new ProviderBudget({ maxCalls, deadline: Date.now() + 10_000 }),
  locale: 'es' as const,
})

const toFind = (raw: typeof TMDB_FIND_EMPTY | typeof TMDB_FIND_IMDB_FIGHT_CLUB | typeof TMDB_FIND_TVDB_BREAKING_BAD) => ({
  movies: raw.movie_results,
  tv: raw.tv_results,
})

describe('matchItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProviderCircuits()
  })

  it('id de TMDB: sin petición', async () => {
    const r = await matchItems([item({ ids: { tmdb: 438631 } })], ctx())
    expect(r.get('0')).toEqual({ status: 'matched', mediaId: 'movie_438631', by: 'tmdb' })
    expect(mocks.find).not.toHaveBeenCalled()
    expect(mocks.searchMovies).not.toHaveBeenCalled()
  })

  it('IMDb ID → TMDB find, con ficha ya normalizada en el idioma de la persona', async () => {
    mocks.find.mockResolvedValue(toFind(TMDB_FIND_IMDB_FIGHT_CLUB))
    const r = await matchItems([item({ ids: { imdb: 'tt0137523' }, title: 'El club de la lucha' })], ctx())
    const m = r.get('0')!
    expect(m).toMatchObject({ status: 'matched', mediaId: 'movie_550', by: 'imdb' })
    expect(m.status === 'matched' && m.item?.title).toBe('Fight Club')
    expect(mocks.find).toHaveBeenCalledWith('tt0137523', 'imdb_id', 'es')
  })

  it('TVDB ID (TV Time) → serie', async () => {
    mocks.find.mockResolvedValue(toFind(TMDB_FIND_TVDB_BREAKING_BAD))
    const r = await matchItems([item({ kind: 'tv', ids: { tvdb: 81189 }, title: 'Breaking Bad' })], ctx())
    expect(r.get('0')).toMatchObject({ status: 'matched', mediaId: 'tv_1396', by: 'tvdb' })
  })

  it('id que TMDB no conoce → se intenta por título y año', async () => {
    mocks.find.mockResolvedValue(toFind(TMDB_FIND_EMPTY))
    mocks.searchMovies.mockResolvedValue(tmdbSearch([tmdbMovie(603, 'The Matrix', '1999-03-30')]))
    const r = await matchItems([item({ ids: { imdb: 'tt0133093' }, title: 'The Matrix', year: 1999 })], ctx())
    expect(r.get('0')).toMatchObject({ status: 'matched', mediaId: 'movie_603', by: 'title_year' })
  })

  it('Letterboxd por título + año: busca en inglés y elige el año correcto (remakes)', async () => {
    mocks.searchMovies.mockResolvedValue(
      tmdbSearch([tmdbMovie(424139, 'Halloween', '2018-10-18'), tmdbMovie(948, 'Halloween', '1978-10-24')])
    )
    const r = await matchItems([item({ title: 'Halloween', year: 1978 })], ctx())
    expect(r.get('0')).toMatchObject({ status: 'matched', mediaId: 'movie_948' })
    expect(mocks.searchMovies).toHaveBeenCalledWith('Halloween', 1, 'en')
    // Buscado en inglés para una persona en español: la ficha se pide luego en su idioma.
    const m = r.get('0')!
    expect(m.status === 'matched' && m.item).toBeUndefined()
  })

  it('título adulto de TMDB → excluded', async () => {
    mocks.searchMovies.mockResolvedValue(tmdbSearch([tmdbMovie(1, 'Algo', '2000-01-01', { adult: true })]))
    const r = await matchItems([item({ title: 'Algo', year: 2000 })], ctx())
    expect(r.get('0')).toEqual({ status: 'excluded' })
  })

  it('MAL ID → AniList en una sola petición por lote; adulto fuera; lo que AniList no tiene, a Jikan', async () => {
    mocks.providerFetch.mockResolvedValue(ANILIST_BY_MAL)
    mocks.jikanAnime.mockResolvedValue(JIKAN_ANIME_5114)
    const items = [
      item({ key: '0', kind: 'anime', title: 'Cowboy Bebop', ids: { mal: 1 } }),
      item({ key: '1', kind: 'anime', title: 'Adulto', ids: { mal: 666 } }),
      item({ key: '2', kind: 'anime', title: 'FMA:B', ids: { mal: 5114 } }),
    ]
    const r = await matchItems(items, ctx())
    expect(r.get('0')).toMatchObject({ status: 'matched', mediaId: 'anime_al-1', by: 'mal' })
    expect(r.get('1')).toEqual({ status: 'excluded' })
    expect(r.get('2')).toMatchObject({ status: 'matched', mediaId: 'anime_5114', by: 'mal' })
    expect(mocks.providerFetch).toHaveBeenCalledTimes(1)
    const [provider, , opts] = mocks.providerFetch.mock.calls[0]
    expect(provider).toBe('anilist')
    const body = JSON.parse(opts.body)
    expect(body.variables.ids).toEqual([1, 666, 5114])
    expect(body.query).toContain('idMal_in: $ids, type: ANIME')
    expect(mocks.jikanAnime).toHaveBeenCalledWith(5114)
  })

  it('AniList caído → Jikan para todos; Jikan 404 → sin emparejar', async () => {
    mocks.providerFetch.mockRejectedValue(new ProviderError('anilist', 'http', 'AniList → 403', { status: 403 }))
    mocks.jikanAnime.mockImplementation(async (id: number) => {
      if (id === 5114) return JIKAN_ANIME_5114
      throw Object.assign(new Error('Jikan → 404'), { status: 404 })
    })
    const r = await matchItems(
      [item({ key: '0', kind: 'anime', ids: { mal: 5114 } }), item({ key: '1', kind: 'anime', ids: { mal: 404 } })],
      ctx()
    )
    expect(r.get('0')).toMatchObject({ status: 'matched', mediaId: 'anime_5114' })
    expect(r.get('1')).toEqual({ status: 'unmatched' })
  })

  it('Goodreads: ISBN en Open Library; sin ISBN, título + autor (otro autor no vale)', async () => {
    mocks.searchOL.mockResolvedValue(OPENLIBRARY_ISBN_HUNGER_GAMES)
    mocks.searchOLTitle.mockResolvedValue(OPENLIBRARY_TITLE_DUNE)
    const r = await matchItems(
      [
        item({ key: '0', kind: 'book', title: 'The Hunger Games', ids: { isbn: ['9780439023481'] } }),
        item({ key: '1', kind: 'book', title: 'Dune', author: 'Frank Herbert', year: 2005 }),
        item({ key: '2', kind: 'book', title: 'Dune', author: 'Nadie Conocido' }),
      ],
      ctx()
    )
    expect(mocks.searchOL).toHaveBeenCalledWith('isbn:9780439023481', 1, {}, 1)
    expect(r.get('0')).toMatchObject({ status: 'matched', mediaId: 'book_OL5735363W', by: 'isbn' })
    expect(r.get('1')).toMatchObject({ status: 'matched', mediaId: 'book_OL893415W', by: 'title' })
    expect(r.get('2')).toEqual({ status: 'unmatched' })
  })

  it('sin presupuesto o proveedor caído → pending (se reintenta), no unmatched', async () => {
    mocks.searchMovies.mockResolvedValue(tmdbSearch([tmdbMovie(1, 'A', '2000-01-01')]))
    const r = await matchItems(
      [item({ key: '0', title: 'A', year: 2000 }), item({ key: '1', title: 'A', year: 2000 })],
      ctx(1)
    )
    const outcomes = [r.get('0')!.status, r.get('1')!.status].sort()
    expect(outcomes).toEqual(['matched', 'pending'])

    mocks.searchMovies.mockReset()
    mocks.searchMovies.mockRejectedValue(new ProviderError('tmdb', 'timeout', 'timeout'))
    const down = await matchItems(
      Array.from({ length: 20 }, (_, i) => item({ key: String(i), title: 'A', year: 2000 })),
      ctx()
    )
    expect(Array.from(down.values()).every((m) => m.status === 'pending')).toBe(true)
    // Tras 3 fallos el proveedor se da por caído en el lote: solo salen las
    // que ya estaban en vuelo (concurrencia de TMDB), no las 20.
    expect(mocks.searchMovies.mock.calls.length).toBeLessThanOrEqual(6)
  })
})
