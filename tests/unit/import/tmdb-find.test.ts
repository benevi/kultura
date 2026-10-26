// @vitest-environment node
// F-26 — findByExternalId: la única función nueva de src/lib/api/tmdb.ts.
// Comprueba la URL (`/find/{id}?external_source=…&language=…`), que pasa por
// providerFetch (circuito y caché) con su contrato y que los géneros de los
// resultados se rellenan como en los listados.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TMDB_FIND_IMDB_FIGHT_CLUB, TMDB_FIND_TVDB_BREAKING_BAD, TMDB_GENRES_MOVIE, TMDB_GENRES_TV } from './fixtures/providers'

const calls: Array<{ provider: string; url: string; opts: Record<string, unknown> }> = []

vi.mock('@/lib/api/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/http')>()
  return {
    ...actual,
    providerFetch: vi.fn(async (provider: string, url: string, opts: Record<string, unknown> = {}) => {
      calls.push({ provider, url, opts })
      const u = new URL(url)
      if (u.pathname === '/3/genre/movie/list') return TMDB_GENRES_MOVIE
      if (u.pathname === '/3/genre/tv/list') return TMDB_GENRES_TV
      if (u.pathname === '/3/find/tt0137523') return TMDB_FIND_IMDB_FIGHT_CLUB
      if (u.pathname === '/3/find/81189') return TMDB_FIND_TVDB_BREAKING_BAD
      throw new Error(`unexpected ${u.pathname}`)
    }),
  }
})

describe('findByExternalId', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('IMDb ID → película, con external_source, idioma y contrato', async () => {
    const { findByExternalId } = await import('@/lib/api/tmdb')
    const res = await findByExternalId('tt0137523', 'imdb_id', 'en')
    expect(res.tv).toEqual([])
    expect(res.movies).toHaveLength(1)
    expect(res.movies[0]).toMatchObject({ id: 550, title: 'Fight Club', release_date: '1999-10-15' })
    // Los géneros llegan como ids y se rellenan con el catálogo.
    expect(res.movies[0].genres).toEqual([{ id: 18, name: 'Drama' }])

    const find = calls.find((c) => c.url.includes('/find/'))!
    expect(find.provider).toBe('tmdb')
    const url = new URL(find.url)
    expect(url.searchParams.get('external_source')).toBe('imdb_id')
    expect(url.searchParams.get('language')).toBe('en-US')
    expect(url.searchParams.get('api_key')).toBeTruthy()
    expect(find.opts.label).toBe('/find')
    // El contrato acepta la respuesta documentada.
    const schema = find.opts.schema as { safeParse: (v: unknown) => { success: boolean } }
    expect(schema.safeParse(TMDB_FIND_IMDB_FIGHT_CLUB).success).toBe(true)
    expect(schema.safeParse({ movie_results: [{ title: 'sin id' }] }).success).toBe(false)
  })

  it('TheTVDB ID → serie', async () => {
    const { findByExternalId } = await import('@/lib/api/tmdb')
    const res = await findByExternalId('81189', 'tvdb_id', 'es')
    expect(res.tv[0]).toMatchObject({ id: 1396, name: 'Breaking Bad' })
    expect(res.tv[0].genres).toEqual([
      { id: 18, name: 'Drama' },
      { id: 80, name: 'Crime' },
    ])
    expect(new URL(calls.find((c) => c.url.includes('/find/'))!.url).searchParams.get('language')).toBe('es-ES')
  })

  it('un id con forma inválida no llama a TMDB (nada de texto libre en la URL)', async () => {
    const { findByExternalId } = await import('@/lib/api/tmdb')
    for (const bad of ['../movie/550', 'tt12', 'tt0137523?x=1', '']) {
      expect(await findByExternalId(bad, 'imdb_id')).toEqual({ movies: [], tv: [] })
    }
    expect(await findByExternalId('81189a', 'tvdb_id')).toEqual({ movies: [], tv: [] })
    expect(calls).toHaveLength(0)
  })
})
