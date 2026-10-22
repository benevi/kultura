// ============================================================
// KULTURA — lib/media: escritura del catálogo `media` desde el servidor
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeDb, fakeClient, type FakeDb } from './fake-supabase'
import { parseMediaId } from '@/lib/media/media-id'
import { localeFromRequest } from '@/lib/media/request-locale'

const mocks = vi.hoisted(() => ({
  state: { db: null as unknown as FakeDb },
  getMovie: vi.fn(),
  getGame: vi.fn(),
  getComic: vi.fn(),
  getAnimeAniList: vi.fn(),
  getAnimeTmdb: vi.fn(),
  getMangaDex: vi.fn(),
  getBookDetail: vi.fn(),
  getGoogleBookDetail: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeClient(mocks.state.db, 'admin'),
}))
vi.mock('@/lib/api/tmdb', async (o) => ({ ...(await o<typeof import('@/lib/api/tmdb')>()), getMovie: mocks.getMovie }))
vi.mock('@/lib/api/rawg', async (o) => ({ ...(await o<typeof import('@/lib/api/rawg')>()), getGame: mocks.getGame }))
vi.mock('@/lib/api/comicvine', async (o) => ({ ...(await o<typeof import('@/lib/api/comicvine')>()), getComic: mocks.getComic }))
vi.mock('@/lib/api/anilist', async (o) => ({ ...(await o<typeof import('@/lib/api/anilist')>()), getAnime: mocks.getAnimeAniList }))
vi.mock('@/lib/api/anime-tmdb', async (o) => ({ ...(await o<typeof import('@/lib/api/anime-tmdb')>()), getAnimeTmdb: mocks.getAnimeTmdb }))
vi.mock('@/lib/api/mangadex', async (o) => ({ ...(await o<typeof import('@/lib/api/mangadex')>()), getManga: mocks.getMangaDex }))
vi.mock('@/lib/api/openlibrary', async (o) => ({ ...(await o<typeof import('@/lib/api/openlibrary')>()), getBookDetail: mocks.getBookDetail }))
vi.mock('@/lib/api/googlebooks', async (o) => ({
  ...(await o<typeof import('@/lib/api/googlebooks')>()),
  getGoogleBookDetail: mocks.getGoogleBookDetail,
}))

function movie(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    title: `Peli ${id}`,
    original_title: `Movie ${id}`,
    overview: 'Sinopsis',
    poster_path: `/p${id}.jpg`,
    backdrop_path: null,
    release_date: '2001-05-01',
    genres: [{ id: 18, name: 'Drama' }],
    vote_average: 7,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.db = createFakeDb({ media: [] })
  mocks.getMovie.mockImplementation(async (id: number) => movie(id))
})

describe('parseMediaId', () => {
  it('acepta las formas de id de cada proveedor', () => {
    for (const id of [
      'movie_550',
      'tv_1399',
      'game_3498',
      'comic_123456',
      'anime_al-21',
      'anime_tmdb-37854',
      'anime_5114',
      'manga_a96676e5-8ae2-425e-b549-7f15dd34a6d8',
      'manga_13',
      'book_OL7353617W',
      'book_zyTCAlFPjgYC',
    ]) {
      expect(parseMediaId(id), id).not.toBeNull()
    }
    expect(parseMediaId('anime_al-21')).toEqual({ id: 'anime_al-21', type: 'anime', externalId: 'al-21' })
  })

  it('rechaza tipos desconocidos, ids vacíos y texto que acabaría en la URL de un proveedor', () => {
    for (const id of [
      'podcast_1',
      'movie_',
      '_550',
      'movie_abc',
      'comic_1/../../users',
      'movie_550?x=1',
      'book_ab',
      'manga_not-a-uuid',
      `movie_${'1'.repeat(90)}`,
      42,
      null,
    ]) {
      expect(parseMediaId(id), String(id)).toBeNull()
    }
  })
})

describe('localeFromRequest', () => {
  const r = (headers: Record<string, string>) => new Request('http://localhost/api/library', { headers })

  it('usa el idioma de la página de origen', () => {
    expect(localeFromRequest(r({ referer: 'https://kulturaapp.vercel.app/en/media/movie/550' }))).toBe('en')
    expect(localeFromRequest(r({ referer: 'https://kulturaapp.vercel.app/es/discover' }))).toBe('es')
  })

  it('cae a la cookie de next-intl y luego al idioma por defecto', () => {
    expect(localeFromRequest(r({ cookie: 'a=1; NEXT_LOCALE=en' }))).toBe('en')
    expect(localeFromRequest(r({ referer: 'no es una url', cookie: 'NEXT_LOCALE=fr' }))).toBe('es')
    expect(localeFromRequest(r({}))).toBe('es')
  })
})

describe('upsertMediaFromProvider', () => {
  it('crea la fila con la ficha del proveedor y con géneros', async () => {
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    const result = await upsertMediaFromProvider('movie_550', { locale: 'en' })

    expect(result).toEqual({ ok: true, id: 'movie_550', title: 'Peli 550', created: true })
    expect(mocks.getMovie).toHaveBeenCalledWith(550, 'en')
    const row = mocks.state.db.tables.media[0]
    expect(row).toMatchObject({
      id: 'movie_550',
      external_id: '550',
      type: 'movie',
      title: 'Peli 550',
      year: 2001,
      synopsis: 'Sinopsis',
    })
    expect(row.metadata).toMatchObject({ genres: ['Drama'] })
  })

  it('crea con ignoreDuplicates: si otra petición la creó a la vez, no la pisa', async () => {
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    mocks.getMovie.mockImplementationOnce(async (id: number) => {
      // Mientras se pedía la ficha, otra petición insertó la fila.
      mocks.state.db.tables.media.push({ id: 'movie_550', external_id: '550', type: 'movie', title: 'Primera', metadata: { genres: ['Drama'] } })
      return movie(id)
    })
    await upsertMediaFromProvider('movie_550')
    expect(mocks.state.db.tables.media).toHaveLength(1)
    expect(mocks.state.db.tables.media[0].title).toBe('Primera')
    const write = mocks.state.db.writes.find((w) => w.op === 'upsert')!
    expect(write.client).toBe('admin')
  })

  it('una fila existente con géneros no se toca ni se pregunta al proveedor', async () => {
    mocks.state.db.tables.media.push({ id: 'movie_550', external_id: '550', type: 'movie', title: 'Guardada', metadata: { genres: ['Drama'] } })
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')

    expect(await upsertMediaFromProvider('movie_550')).toEqual({ ok: true, id: 'movie_550', title: 'Guardada', created: false })
    expect(mocks.getMovie).not.toHaveBeenCalled()
    expect(mocks.state.db.writes).toEqual([])
  })

  it('a una fila existente sin géneros solo se le añade metadata.genres (conserva el resto)', async () => {
    mocks.state.db.tables.media.push({
      id: 'movie_550', external_id: '550', type: 'movie', title: 'Guardada', poster: 'p', metadata: { runtime: 120 },
    })
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    await upsertMediaFromProvider('movie_550')

    const row = mocks.state.db.tables.media[0]
    expect(row.title).toBe('Guardada')
    expect(row.poster).toBe('p')
    expect(row.metadata).toMatchObject({ runtime: 120, genres: ['Drama'] })
    expect(mocks.state.db.writes.map((w) => w.op)).toEqual(['update'])
  })

  it('una fila existente con un id de forma antigua sigue sirviendo (no se exige la forma actual)', async () => {
    mocks.state.db.tables.media.push({ id: 'book_x', external_id: 'x', type: 'book', title: 'Antiguo', metadata: { genres: ['Novela'] } })
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    expect((await upsertMediaFromProvider('book_x')).ok).toBe(true)
  })

  it('id con forma inválida → invalid_id sin llamar a nadie', async () => {
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    expect(await upsertMediaFromProvider('comic_1/../x')).toEqual({ ok: false, id: 'comic_1/../x', reason: 'invalid_id' })
    expect(mocks.getComic).not.toHaveBeenCalled()
  })

  it('proveedor caído → unavailable y no se crea nada', async () => {
    mocks.getMovie.mockRejectedValue(new Error('TMDB 503'))
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    expect(await upsertMediaFromProvider('movie_550')).toMatchObject({ ok: false, reason: 'unavailable' })
    expect(mocks.state.db.tables.media).toEqual([])
  })

  it('error de base al leer → db_error', async () => {
    mocks.state.db.failures.media = { message: 'boom' }
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    expect(await upsertMediaFromProvider('movie_550')).toMatchObject({ ok: false, reason: 'db_error' })
  })

  it('enruta cada forma de id a su proveedor', async () => {
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    mocks.getGame.mockResolvedValue({ id: 9, name: 'Juego', genres: [{ name: 'Action' }], rating: 4, released: '2020-01-01', background_image: null })
    mocks.getComic.mockResolvedValue({ id: 77, name: 'Origen', issue_number: '1', cover_date: '1990-01-01', image: { medium_url: 'https://c/x.jpg' }, volume: { id: 1, name: 'Batman' } })
    mocks.getAnimeAniList.mockResolvedValue({ id: 21, title: { romaji: 'One Piece' }, genres: ['Adventure'] })
    mocks.getAnimeTmdb.mockResolvedValue({ item: { id: 'anime_tmdb-5', externalId: 'tmdb-5', type: 'anime', title: 'Anime TMDB', genres: ['Animación'] } })

    expect((await upsertMediaFromProvider('game_9')).ok).toBe(true)
    expect(mocks.getGame).toHaveBeenCalledWith(9)
    expect((await upsertMediaFromProvider('comic_77')).ok).toBe(true)
    expect(mocks.getComic).toHaveBeenCalledWith('77')
    expect((await upsertMediaFromProvider('anime_al-21')).ok).toBe(true)
    expect(mocks.getAnimeAniList).toHaveBeenCalledWith(21)
    expect((await upsertMediaFromProvider('anime_tmdb-5', { locale: 'en' })).ok).toBe(true)
    expect(mocks.getAnimeTmdb).toHaveBeenCalledWith('tmdb-5', 'en')

    const byId = Object.fromEntries(mocks.state.db.tables.media.map((r) => [r.id, r]))
    expect(byId.comic_77.title).toContain('Batman')
    expect(byId['anime_tmdb-5']).toMatchObject({ type: 'anime', external_id: 'tmdb-5', title: 'Anime TMDB' })
  })

  it('libro de Google Books que no existe → unavailable', async () => {
    mocks.getGoogleBookDetail.mockResolvedValue(null)
    const { upsertMediaFromProvider } = await import('@/lib/media/upsert-from-provider')
    expect(await upsertMediaFromProvider('book_zyTCAlFPjgYC')).toMatchObject({ ok: false, reason: 'unavailable' })
  })
})

describe('ensureMediaRows (importación)', () => {
  it('no toca las filas existentes y crea las que faltan desde el proveedor', async () => {
    mocks.state.db.tables.media.push({ id: 'movie_1', external_id: '1', type: 'movie', title: 'Ya estaba', metadata: null })
    const { ensureMediaRows } = await import('@/lib/media/upsert-from-provider')

    const { available, unresolved } = await ensureMediaRows(['movie_1', 'movie_2', 'movie_2', 'podcast_1'])

    expect(Array.from(available).sort()).toEqual(['movie_1', 'movie_2'])
    expect(unresolved).toEqual(['podcast_1'])
    expect(mocks.getMovie).toHaveBeenCalledTimes(1)
    expect(mocks.state.db.tables.media.find((r) => r.id === 'movie_1')!.title).toBe('Ya estaba')
    expect(mocks.state.db.writes.every((w) => w.client === 'admin' && w.op === 'upsert')).toBe(true)
  })

  it('respeta el tope de títulos nuevos por llamada y la concurrencia', async () => {
    let inFlight = 0
    let peak = 0
    mocks.getMovie.mockImplementation(async (id: number) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 2))
      inFlight--
      return movie(id)
    })
    const { ensureMediaRows } = await import('@/lib/media/upsert-from-provider')
    const ids = Array.from({ length: 12 }, (_, i) => `movie_${i + 1}`)

    const { available, unresolved } = await ensureMediaRows(ids, { maxResolve: 5, concurrency: 2 })

    expect(available.size).toBe(5)
    expect(unresolved).toHaveLength(7)
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('al agotar el presupuesto de tiempo deja el resto como pendiente', async () => {
    mocks.getMovie.mockImplementation(async (id: number) => {
      await new Promise((r) => setTimeout(r, 15))
      return movie(id)
    })
    const { ensureMediaRows } = await import('@/lib/media/upsert-from-provider')
    const ids = Array.from({ length: 6 }, (_, i) => `movie_${i + 1}`)

    const { available, unresolved } = await ensureMediaRows(ids, { budgetMs: 10, concurrency: 1 })

    expect(available.size).toBeGreaterThanOrEqual(1)
    expect(available.size + unresolved.length).toBe(6)
    expect(unresolved.length).toBeGreaterThan(0)
  })

  it('lista vacía → no consulta nada', async () => {
    const { ensureMediaRows } = await import('@/lib/media/upsert-from-provider')
    const result = await ensureMediaRows([])
    expect(result.available.size).toBe(0)
    expect(mocks.state.db.writes).toEqual([])
  })
})
