// ============================================================
// F-25 (PRO-6) — «¿Qué veo esta noche?»: con Netflix y Filmin marcados,
// solo salen (y «Sorpréndeme» solo elige) pendientes que están en ellas.
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  expandServices,
  normalizeServices,
  platformNames,
  platformRegionFor,
} from '@/app/[locale]/(app)/settings/platforms'
import { availableTonight, matchPlatforms, tmdbRefOf, TONIGHT_MAX_CHECKS } from '@/app/[locale]/(app)/home/tonight'
import { pickIndex } from '@/app/[locale]/(app)/home/TonightClient'
import type { TmdbProvidersResponse } from '@/lib/api/tmdb'

vi.mock('@/lib/api/tmdb', () => ({ getMovieProviders: vi.fn(), getTVProviders: vi.fn() }))
vi.mock('@/i18n/navigation', () => ({ Link: () => null }))

const NETFLIX = 8
const FILMIN = 63
const DISNEY = 337

function offer(region: string, kinds: Record<string, Array<[number, string]>>): TmdbProvidersResponse {
  return {
    results: {
      [region]: Object.fromEntries(
        Object.entries(kinds).map(([k, list]) => [k, list.map(([provider_id, provider_name]) => ({ provider_id, provider_name, logo_path: '/x.png' }))]),
      ),
    },
  } as unknown as TmdbProvidersResponse
}

describe('catálogo de plataformas', () => {
  it('normaliza lo guardado: enteros positivos, sin repetidos, máx. 30', () => {
    expect(normalizeServices([8, '63', 8, -1, 0, 1.5, 'x', null])).toEqual([8, 63])
    expect(normalizeServices('8')).toEqual([])
    expect(normalizeServices(Array.from({ length: 40 }, (_, i) => i + 1))).toHaveLength(30)
  })

  it('región: la guardada o la del idioma', () => {
    expect(platformRegionFor('US', 'es')).toBe('US')
    expect(platformRegionFor(null, 'en')).toBe('US')
    expect(platformRegionFor('FR', 'es')).toBe('ES')
  })

  it('las variantes con anuncios cuentan como la misma suscripción', () => {
    expect(expandServices([NETFLIX], 'ES').has(1796)).toBe(true)
    expect(platformNames([NETFLIX, FILMIN, 999], 'ES')).toEqual(['Netflix', 'Filmin'])
  })
})

describe('tmdbRefOf', () => {
  it('cine, series y anime servido por TMDB; el resto no', () => {
    expect(tmdbRefOf('movie_550')).toEqual({ kind: 'movie', id: 550 })
    expect(tmdbRefOf('tv_1399')).toEqual({ kind: 'tv', id: 1399 })
    expect(tmdbRefOf('anime_tmdb-31911')).toEqual({ kind: 'tv', id: 31911 })
    expect(tmdbRefOf('anime_16498')).toBeNull()
    expect(tmdbRefOf('book_abc')).toBeNull()
  })
})

describe('matchPlatforms', () => {
  it('suscripción, gratis y con anuncios sí; alquiler y compra no; otra región no', () => {
    const resp = offer('ES', { flatrate: [[NETFLIX, 'Netflix']], rent: [[FILMIN, 'Filmin']] })
    expect(matchPlatforms(resp, [NETFLIX, FILMIN], 'ES')).toEqual(['Netflix'])
    expect(matchPlatforms(resp, [NETFLIX], 'US')).toEqual([])
    const ads = offer('ES', { ads: [[1796, 'Netflix basic with Ads']] })
    expect(matchPlatforms(ads, [NETFLIX], 'ES')).toEqual(['Netflix'])
  })
})

describe('availableTonight', () => {
  const candidates = [
    { mediaId: 'movie_1', title: 'En Netflix', poster: null, type: 'movie' },
    { mediaId: 'movie_2', title: 'En Disney+', poster: null, type: 'movie' },
    { mediaId: 'tv_3', title: 'En Filmin', poster: null, type: 'tv' },
    { mediaId: 'movie_4', title: 'Solo alquiler', poster: null, type: 'movie' },
    { mediaId: 'book_5', title: 'Un libro', poster: null, type: 'book' },
    { mediaId: 'movie_6', title: 'Proveedor caído', poster: null, type: 'movie' },
  ]
  const fetchers = {
    movie: vi.fn(async (id: number) => {
      if (id === 1) return offer('ES', { flatrate: [[NETFLIX, 'Netflix']] })
      if (id === 2) return offer('ES', { flatrate: [[DISNEY, 'Disney Plus']] })
      if (id === 4) return offer('ES', { rent: [[NETFLIX, 'Netflix']] })
      throw new Error('TMDB caído')
    }),
    tv: vi.fn(async () => offer('ES', { flatrate: [[FILMIN, 'Filmin']] })),
  }

  it('con Netflix y Filmin marcados, solo lo que está en ellas', async () => {
    const picks = await availableTonight(candidates, [NETFLIX, FILMIN], 'ES', 'es', fetchers)
    expect(picks.map((p) => p.title)).toEqual(['En Netflix', 'En Filmin'])
    expect(picks[1].platforms).toEqual(['Filmin'])
    // El libro no se consulta a TMDB.
    expect(fetchers.movie).toHaveBeenCalledTimes(4)
  })

  it('sin plataformas no consulta nada', async () => {
    fetchers.movie.mockClear()
    expect(await availableTonight(candidates, [], 'ES', 'es', fetchers)).toEqual([])
    expect(fetchers.movie).not.toHaveBeenCalled()
  })

  it(`como mucho ${TONIGHT_MAX_CHECKS} consultas por visita`, async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ mediaId: `movie_${i + 100}`, title: `T${i}`, poster: null, type: 'movie' }))
    const movie = vi.fn(async () => offer('ES', { flatrate: [[NETFLIX, 'Netflix']] }))
    await availableTonight(many, [NETFLIX], 'ES', 'es', { movie, tv: movie })
    expect(movie).toHaveBeenCalledTimes(TONIGHT_MAX_CHECKS)
  })
})

describe('Sorpréndeme: pickIndex', () => {
  it('nunca repite el anterior si hay más de uno', () => {
    expect(pickIndex(3, 1, () => 0.4)).toBe(2)
    expect(pickIndex(3, null, () => 0.4)).toBe(1)
    expect(pickIndex(1, 0, () => 0.9)).toBe(0)
  })
})
