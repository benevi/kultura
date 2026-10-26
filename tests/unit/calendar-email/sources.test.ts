// ============================================================
// F-28 — Calendario: de cada API oficial a eventos (parse*), qué se consulta
// por cada id (planFor) y la forma exacta de las peticiones (fetch*).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  anilistKey,
  buildAniListQuery,
  fetchAniListBatch,
  fetchMangaDexFeed,
  fetchRawgGame,
  fetchTmdbMovie,
  fetchTmdbTv,
  indexAniList,
  parseAniList,
  parseMangaDexFeed,
  parseRawgGame,
  parseTmdbMovie,
  parseTmdbTv,
  planFor,
  CALENDAR_PROVIDER_REVALIDATE_SECONDS,
  anilistCalendarSchema,
  mangadexFeedSchema,
  rawgGameCalendarSchema,
  tmdbMovieCalendarSchema,
  tmdbTvCalendarSchema,
} from '@/lib/calendar/sources'
import { resetProviderCircuits } from '@/lib/api/http'
import {
  WINDOW,
  anilistBatch,
  candidate,
  mangadexFeed,
  rawgGameDay,
  rawgGameOld,
  rawgGameTba,
  rawgGameTbaYear,
  tmdbMovieUpcoming,
  tmdbTvEnded,
  tmdbTvReturning,
  tmdbTvSeasonPremiere,
  tmdbTvUpcoming,
} from './fixtures'

describe('los ejemplos cumplen los contratos mínimos', () => {
  it.each([
    ['tmdb tv', tmdbTvCalendarSchema, tmdbTvReturning],
    ['tmdb tv terminada', tmdbTvCalendarSchema, tmdbTvEnded],
    ['tmdb tv sin estrenar', tmdbTvCalendarSchema, tmdbTvUpcoming],
    ['tmdb movie', tmdbMovieCalendarSchema, tmdbMovieUpcoming],
    ['rawg', rawgGameCalendarSchema, rawgGameDay],
    ['rawg tba', rawgGameCalendarSchema, rawgGameTba],
    ['anilist', anilistCalendarSchema, anilistBatch],
    ['mangadex', mangadexFeedSchema, mangadexFeed],
  ])('%s', (_n, schema, value) => {
    expect(schema.safeParse(value).success).toBe(true)
  })
})

describe('TMDB series', () => {
  it('en curso: el próximo episodio (con nombre) y el de la semana pasada', () => {
    const events = parseTmdbTv(candidate('tv_100088'), tmdbTvReturning, WINDOW)
    expect(events).toEqual([
      expect.objectContaining({ kind: 'episode', date: '2026-12-14', season: 3, episode: 3, episodeName: 'Kilómetro cero', precision: 'day' }),
      expect.objectContaining({ kind: 'episode', date: '2026-12-07', season: 3, episode: 2 }),
    ])
  })

  it('temporada nueva: estreno de temporada; también si la tienes pendiente', () => {
    for (const status of ['in_progress', 'pending'] as const) {
      const events = parseTmdbTv(candidate('tv_66732', status), tmdbTvSeasonPremiere, WINDOW)
      expect(events[0]).toMatchObject({ kind: 'season_premiere', date: '2026-12-18', season: 5, episode: 1 })
    }
  })

  it('pendiente: un episodio normal no interesa (solo estrenos)', () => {
    expect(parseTmdbTv(candidate('tv_100088', 'pending'), tmdbTvReturning, WINDOW)).toEqual([])
  })

  it('terminada: nada', () => {
    expect(parseTmdbTv(candidate('tv_1396'), tmdbTvEnded, WINDOW)).toEqual([])
  })

  it('sin estrenar y pendiente: el estreno por first_air_date', () => {
    expect(parseTmdbTv(candidate('tv_250307', 'pending'), tmdbTvUpcoming, WINDOW)).toEqual([
      expect.objectContaining({ kind: 'series_premiere', date: '2027-01-20', season: 1, episode: 1 }),
    ])
  })

  it('fuera de la ventana (más de 90 días) no sale', () => {
    const far = { ...tmdbTvReturning, next_episode_to_air: { ...tmdbTvReturning.next_episode_to_air, air_date: '2027-06-01' } }
    expect(parseTmdbTv(candidate('tv_1'), far, WINDOW).map((e) => e.date)).toEqual(['2026-12-07'])
  })

  it('una fecha basura no rompe nada', () => {
    const bad = { ...tmdbTvReturning, next_episode_to_air: { air_date: '2026-13-45' }, last_episode_to_air: null }
    expect(parseTmdbTv(candidate('tv_1'), bad, WINDOW)).toEqual([])
  })
})

describe('TMDB películas', () => {
  it('pendiente: cines en la región (no el preestreno, type 1)', () => {
    const es = parseTmdbMovie(candidate('movie_1084242', 'pending'), tmdbMovieUpcoming, WINDOW)
    expect(es).toEqual([expect.objectContaining({ kind: 'theatrical', date: '2026-12-18', region: 'ES' })])
  })

  it('en EE. UU.: cines y digital', () => {
    const us = parseTmdbMovie(candidate('movie_1084242', 'pending'), tmdbMovieUpcoming, { ...WINDOW, region: 'US' })
    expect(us.map((e) => [e.kind, e.date])).toEqual([
      ['theatrical', '2026-12-18'],
      ['digital', '2027-02-02'],
    ])
  })

  it('sin fechas para el país: la general', () => {
    const fr = parseTmdbMovie(candidate('movie_1', 'pending'), tmdbMovieUpcoming, { ...WINDOW, region: 'FR' })
    expect(fr).toEqual([expect.objectContaining({ kind: 'release', date: '2026-12-16' })])
  })

  it('una película "en curso" no tiene calendario', () => {
    expect(parseTmdbMovie(candidate('movie_1', 'in_progress'), tmdbMovieUpcoming, WINDOW)).toEqual([])
  })
})

describe('RAWG juegos', () => {
  it('con día', () => {
    expect(parseRawgGame(candidate('game_58550', 'pending'), rawgGameDay, WINDOW)).toEqual([
      expect.objectContaining({ kind: 'release', date: '2026-12-17', precision: 'day' }),
    ])
  })
  it('por anunciar, sin fecha', () => {
    expect(parseRawgGame(candidate('game_3328', 'pending'), rawgGameTba, WINDOW)).toEqual([
      expect.objectContaining({ kind: 'release', date: null, precision: 'tba' }),
    ])
  })
  it('por anunciar con el 31-12 de relleno: es un año, no un día', () => {
    expect(parseRawgGame(candidate('game_4200', 'pending'), rawgGameTbaYear, WINDOW)).toEqual([
      expect.objectContaining({ date: '2027-01-01', precision: 'year' }),
    ])
  })
  it('ya publicado: nada', () => {
    expect(parseRawgGame(candidate('game_3498', 'pending'), rawgGameOld, WINDOW)).toEqual([])
  })
})

describe('AniList', () => {
  const byKey = indexAniList(anilistBatch)

  it('indexa por id propio y por id de MAL (por tipo)', () => {
    expect([...byKey.keys()].sort()).toEqual(['id:180000', 'id:21', 'id:30013', 'mal:ANIME:52991'])
  })

  it('en curso: próximo episodio con la hora de Madrid', () => {
    const [e] = parseAniList(candidate('anime_al-21'), byKey.get('id:21')!, WINDOW)
    expect(e).toMatchObject({ kind: 'episode', episode: 1160, date: '2026-12-20', time: '10:30' })
  })

  it('pendiente con el episodio 1 anunciado: estreno', () => {
    const [e] = parseAniList(candidate('anime_52991', 'pending'), byKey.get('mal:ANIME:52991')!, WINDOW)
    expect(e).toMatchObject({ kind: 'series_premiere', date: '2026-12-16', time: '16:00' })
  })

  it('sin estrenar con mes: precisión de mes aunque caiga fuera de la ventana', () => {
    const [e] = parseAniList(candidate('anime_al-180000', 'pending'), byKey.get('id:180000')!, WINDOW)
    expect(e).toMatchObject({ kind: 'series_premiere', date: '2027-04-01', precision: 'month' })
  })

  it('manga en publicación: AniList no da calendario de capítulos', () => {
    expect(parseAniList(candidate('manga_al-30013'), byKey.get('id:30013')!, WINDOW)).toEqual([])
  })

  it('una sola consulta para todos, con alias y variables', () => {
    const plans = [
      planFor(candidate('anime_al-21'))!,
      planFor(candidate('manga_al-30013'))!,
      planFor(candidate('anime_52991'))!,
      planFor(candidate('manga_13'))!,
    ] as Array<Extract<NonNullable<ReturnType<typeof planFor>>, { source: 'anilist' }>>
    const built = buildAniListQuery(plans)!
    expect(built.variables).toEqual({ ids: [21, 30013], malAnime: [52991], malManga: [13] })
    expect(built.query).toContain('byId: Page(perPage: 50) { media(id_in: $ids)')
    expect(built.query).toContain('malAnime: Page(perPage: 50) { media(idMal_in: $malAnime, type: ANIME)')
    expect(built.query).toContain('malManga: Page(perPage: 50) { media(idMal_in: $malManga, type: MANGA)')
    expect(built.query).toContain('nextAiringEpisode { airingAt episode }')
    expect(plans.map(anilistKey)).toEqual(['id:21', 'id:30013', 'mal:ANIME:52991', 'mal:MANGA:13'])
    expect(buildAniListQuery([])).toBeNull()
  })
})

describe('MangaDex', () => {
  it('el último capítulo (en el idioma preferido) y el programado', () => {
    const events = parseMangaDexFeed(candidate('manga_a1b2c3d4-0000-4000-8000-000000000000'), mangadexFeed, WINDOW)
    expect(events).toEqual([
      // 1170 salió en inglés el 12 y en español el 13: cuenta el español.
      expect.objectContaining({ kind: 'chapter', chapter: '1170', date: '2026-12-13', time: null }),
      expect.objectContaining({ kind: 'chapter', chapter: '1171', date: '2026-12-19', time: '16:00' }),
    ])
  })

  it('en inglés prefiere el inglés', () => {
    const events = parseMangaDexFeed(candidate('manga_x'), mangadexFeed, { ...WINDOW, locale: 'en' })
    expect(events[0]).toMatchObject({ chapter: '1170', date: '2026-12-12' })
  })

  it('capítulos viejos (más de 7 días): nada', () => {
    const old = { data: [{ attributes: { chapter: '5', translatedLanguage: 'es', readableAt: '2026-11-01T00:00:00+00:00' } }] }
    expect(parseMangaDexFeed(candidate('manga_x'), old, WINDOW)).toEqual([])
  })
})

describe('planFor: qué se consulta según el id', () => {
  it.each([
    ['tv_1399', { source: 'tmdb_tv', id: 1399 }],
    ['movie_550', { source: 'tmdb_movie', id: 550 }],
    ['game_3498', { source: 'rawg', id: 3498 }],
    ['anime_tmdb-37854', { source: 'tmdb_tv', id: 37854 }],
    ['anime_al-21', { source: 'anilist', id: 21, by: 'id', mediaType: 'ANIME' }],
    ['anime_21', { source: 'anilist', id: 21, by: 'mal', mediaType: 'ANIME' }],
    ['manga_a1b2c3d4-0000-4000-8000-000000000000', { source: 'mangadex', id: 'a1b2c3d4-0000-4000-8000-000000000000' }],
    ['manga_al-30013', { source: 'anilist', id: 30013, by: 'id', mediaType: 'MANGA' }],
    ['manga_13', { source: 'anilist', id: 13, by: 'mal', mediaType: 'MANGA' }],
    ['book_OL1W', null],
    ['comic_4050-1', null],
    ['tv_abc', null],
  ])('%s', (id, plan) => {
    expect(planFor(candidate(id))).toEqual(plan)
  })
})

describe('peticiones: forma exacta y caché de 6 h', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    resetProviderCircuits()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

  it('TMDB serie: /3/tv/{id} con idioma, sin append (lo mínimo)', async () => {
    fetchMock.mockResolvedValueOnce(ok(tmdbTvReturning))
    await fetchTmdbTv(100088, 'en')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://api.themoviedb.org/3/tv/100088')
    expect(url.searchParams.get('language')).toBe('en-US')
    expect(url.searchParams.get('append_to_response')).toBeNull()
    expect(CALENDAR_PROVIDER_REVALIDATE_SECONDS).toBe(21600)
  })

  it('TMDB película: con release_dates', async () => {
    fetchMock.mockResolvedValueOnce(ok(tmdbMovieUpcoming))
    await fetchTmdbMovie(1084242)
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/3/movie/1084242')
    expect(url.searchParams.get('append_to_response')).toBe('release_dates')
  })

  it('RAWG: /api/games/{id} con la clave', async () => {
    fetchMock.mockResolvedValueOnce(ok(rawgGameDay))
    await fetchRawgGame(58550)
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://api.rawg.io/api/games/58550')
    expect(url.searchParams.get('key')).toBeTruthy()
  })

  it('MangaDex: feed ordenado, con futuros, idiomas y clasificaciones', async () => {
    fetchMock.mockResolvedValueOnce(ok(mangadexFeed))
    await fetchMangaDexFeed('a1b2c3d4-0000-4000-8000-000000000000', 'es')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/manga/a1b2c3d4-0000-4000-8000-000000000000/feed')
    expect(url.searchParams.get('order[readableAt]')).toBe('desc')
    expect(url.searchParams.get('includeFutureUpdates')).toBe('1')
    expect(url.searchParams.getAll('translatedLanguage[]')).toEqual(['es', 'es-la', 'en'])
    expect(url.searchParams.getAll('contentRating[]')).toEqual(['safe', 'suggestive', 'erotica'])
  })

  it('AniList: un POST GraphQL; los errores dentro del 200 se lanzan', async () => {
    fetchMock.mockResolvedValueOnce(ok(anilistBatch))
    const plans = [planFor(candidate('anime_al-21'))!] as Parameters<typeof fetchAniListBatch>[0]
    const found = await fetchAniListBatch(plans)
    expect(found.get('id:21')?.nextAiringEpisode?.episode).toBe(1160)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://graphql.anilist.co')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).variables).toEqual({ ids: [21] })

    fetchMock.mockResolvedValueOnce(ok({ errors: [{ message: 'Too Many Requests.', status: 429 }], data: null }))
    await expect(fetchAniListBatch([planFor(candidate('anime_al-22'))!] as typeof plans)).rejects.toThrow()
  })
})
