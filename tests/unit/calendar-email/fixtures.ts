// ============================================================
// F-28 — Respuestas de ejemplo con la FORMA de las APIs oficiales (el proxy de
// desarrollo no deja llegar a los proveedores). Campos y tipos copiados de:
//   TMDB  GET /3/tv/{series_id}            (developer.themoviedb.org/reference/tv-series-details)
//   TMDB  GET /3/movie/{id}?append_to_response=release_dates
//                                           (…/reference/movie-details, …/movie-release-dates)
//   RAWG  GET /api/games/{id}               (api.rawg.io/docs/#operation/games_read)
//   AniList GraphQL Page.media              (docs.anilist.co/reference/object/media)
//   MangaDex GET /manga/{id}/feed           (api.mangadex.org/docs/redoc.html#tag/Manga/operation/get-manga-id-feed)
// Se recortan campos que el calendario no lee, nunca se inventan otros.
// `tests/contract/calendar.contract.test.ts` comprueba estas formas contra las APIs reales.
// Fecha de referencia de los tests: lunes 14-12-2026, 07:00 en Madrid (semana 2026-W51).
// ============================================================

import type { CalendarCandidate } from '@/lib/calendar/types'

export const NOW = new Date('2026-12-14T06:00:00Z')
export const TODAY = '2026-12-14'

export const tmdbTvReturning = {
  adult: false,
  backdrop_path: '/9faGSFi5jam6pDWGNd0p8JcJgXQ.jpg',
  first_air_date: '2023-01-15',
  genres: [{ id: 18, name: 'Drama' }],
  id: 100088,
  in_production: true,
  last_air_date: '2026-12-07',
  last_episode_to_air: {
    id: 6012345,
    name: 'Lo que queda',
    overview: '…',
    vote_average: 8.1,
    vote_count: 12,
    air_date: '2026-12-07',
    episode_number: 2,
    episode_type: 'standard',
    production_code: '',
    runtime: 58,
    season_number: 3,
    show_id: 100088,
    still_path: '/a.jpg',
  },
  name: 'The Last of Us',
  next_episode_to_air: {
    id: 6012346,
    name: 'Kilómetro cero',
    overview: '…',
    vote_average: 0,
    vote_count: 0,
    air_date: '2026-12-14',
    episode_number: 3,
    episode_type: 'standard',
    production_code: '',
    runtime: null,
    season_number: 3,
    show_id: 100088,
    still_path: null,
  },
  number_of_episodes: 19,
  number_of_seasons: 3,
  poster_path: '/el1KQzwdIm17I3A6cYPfsVIWhfX.jpg',
  status: 'Returning Series',
  type: 'Scripted',
}

/** Temporada nueva anunciada (T5E1) de una serie en curso. */
export const tmdbTvSeasonPremiere = {
  ...tmdbTvReturning,
  id: 66732,
  name: 'Stranger Things',
  last_air_date: '2025-12-31',
  last_episode_to_air: { ...tmdbTvReturning.last_episode_to_air, air_date: '2025-12-31', season_number: 4, episode_number: 9 },
  next_episode_to_air: { ...tmdbTvReturning.next_episode_to_air, air_date: '2026-12-18', season_number: 5, episode_number: 1, name: 'Capítulo uno' },
}

/** Serie terminada: TMDB devuelve `next_episode_to_air: null`. */
export const tmdbTvEnded = {
  ...tmdbTvReturning,
  id: 1396,
  name: 'Breaking Bad',
  in_production: false,
  status: 'Ended',
  last_air_date: '2013-09-29',
  last_episode_to_air: { ...tmdbTvReturning.last_episode_to_air, air_date: '2013-09-29', season_number: 5, episode_number: 16 },
  next_episode_to_air: null,
}

/** Serie aún no estrenada (pendiente): sin episodios emitidos ni anunciados. */
export const tmdbTvUpcoming = {
  ...tmdbTvReturning,
  id: 250307,
  name: 'Estreno de invierno',
  first_air_date: '2027-01-20',
  in_production: true,
  status: 'In Production',
  last_air_date: null,
  last_episode_to_air: null,
  next_episode_to_air: null,
}

export const tmdbMovieUpcoming = {
  adult: false,
  backdrop_path: '/x.jpg',
  id: 1084242,
  original_title: 'Avengers: Doomsday',
  poster_path: '/p.jpg',
  release_date: '2026-12-16',
  status: 'Post Production',
  title: 'Vengadores: Doomsday',
  release_dates: {
    results: [
      {
        iso_3166_1: 'ES',
        release_dates: [
          { certification: '', descriptors: [], iso_639_1: '', note: '', release_date: '2026-12-18T00:00:00.000Z', type: 3 },
        ],
      },
      {
        iso_3166_1: 'US',
        release_dates: [
          { certification: 'PG-13', descriptors: [], iso_639_1: '', note: 'Premiere', release_date: '2026-12-14T00:00:00.000Z', type: 1 },
          { certification: 'PG-13', descriptors: [], iso_639_1: '', note: '', release_date: '2026-12-18T00:00:00.000Z', type: 3 },
          { certification: 'PG-13', descriptors: [], iso_639_1: '', note: '', release_date: '2027-02-02T00:00:00.000Z', type: 4 },
        ],
      },
    ],
  },
}

export const rawgGameDay = {
  id: 58550,
  slug: 'ghost-of-yotei',
  name: 'Ghost of Yōtei',
  released: '2026-12-17',
  tba: false,
  background_image: 'https://media.rawg.io/media/games/a.jpg',
  rating: 0,
  rating_top: 0,
  metacritic: null,
  playtime: 0,
}

export const rawgGameTba = { ...rawgGameDay, id: 3328, name: 'Por anunciar', released: null, tba: true }
export const rawgGameTbaYear = { ...rawgGameDay, id: 4200, name: 'Algún día de 2027', released: '2027-12-31', tba: true }
export const rawgGameOld = { ...rawgGameDay, id: 3498, name: 'GTA V', released: '2013-09-17', tba: false }

/** `airingAt` en segundos Unix (UTC), como lo da AniList. */
export const anilistBatch = {
  data: {
    byId: {
      media: [
        {
          id: 21,
          idMal: 21,
          type: 'ANIME',
          status: 'RELEASING',
          startDate: { year: 1999, month: 10, day: 20 },
          // 2026-12-20 09:30 UTC = 10:30 en Madrid.
          nextAiringEpisode: { airingAt: 1797759000, episode: 1160 },
        },
        {
          id: 180000,
          idMal: 61000,
          type: 'ANIME',
          status: 'NOT_YET_RELEASED',
          startDate: { year: 2027, month: 4, day: null },
          nextAiringEpisode: null,
        },
        {
          id: 30013,
          idMal: 13,
          type: 'MANGA',
          status: 'RELEASING',
          startDate: { year: 1997, month: 7, day: 22 },
          nextAiringEpisode: null,
        },
      ],
    },
    malAnime: {
      media: [
        {
          id: 170000,
          idMal: 52991,
          type: 'ANIME',
          status: 'NOT_YET_RELEASED',
          startDate: { year: 2026, month: 12, day: 16 },
          // 2026-12-16 15:00 UTC = 16:00 en Madrid.
          nextAiringEpisode: { airingAt: 1797433200, episode: 1 },
        },
      ],
    },
  },
}

export const mangadexFeed = {
  result: 'ok',
  response: 'collection',
  data: [
    {
      id: '0f1c0a61-1111-4111-8111-111111111111',
      type: 'chapter',
      attributes: {
        volume: null,
        chapter: '1170',
        title: 'Nueva era',
        translatedLanguage: 'en',
        externalUrl: null,
        publishAt: '2026-12-12T15:00:00+00:00',
        readableAt: '2026-12-12T15:00:00+00:00',
        createdAt: '2026-12-12T14:59:00+00:00',
        updatedAt: '2026-12-12T15:00:00+00:00',
        pages: 17,
        version: 1,
      },
      relationships: [{ id: 'g1', type: 'scanlation_group' }],
    },
    {
      id: '0f1c0a61-2222-4222-8222-222222222222',
      type: 'chapter',
      attributes: {
        volume: null,
        chapter: '1170',
        title: 'Nueva era',
        translatedLanguage: 'es-la',
        externalUrl: null,
        publishAt: '2026-12-13T10:00:00+00:00',
        readableAt: '2026-12-13T10:00:00+00:00',
        createdAt: '2026-12-13T09:00:00+00:00',
        updatedAt: '2026-12-13T10:00:00+00:00',
        pages: 17,
        version: 1,
      },
      relationships: [],
    },
    {
      id: '0f1c0a61-3333-4333-8333-333333333333',
      type: 'chapter',
      attributes: {
        volume: null,
        chapter: '1171',
        title: null,
        translatedLanguage: 'es-la',
        externalUrl: null,
        // Programado (MangaDex publica a la hora fijada: includeFutureUpdates=1).
        publishAt: '2026-12-19T15:00:00+00:00',
        readableAt: '2026-12-19T15:00:00+00:00',
        createdAt: '2026-12-13T09:00:00+00:00',
        updatedAt: '2026-12-13T09:00:00+00:00',
        pages: 18,
        version: 1,
      },
      relationships: [],
    },
  ],
  limit: 12,
  offset: 0,
  total: 2341,
}

export function candidate(mediaId: string, status: CalendarCandidate['status'] = 'in_progress', title = mediaId): CalendarCandidate {
  const i = mediaId.indexOf('_')
  return {
    mediaId,
    type: mediaId.slice(0, i) as CalendarCandidate['type'],
    externalId: mediaId.slice(i + 1),
    title,
    poster: null,
    status,
  }
}

export const WINDOW = { today: TODAY, until: '2027-03-14', now: NOW, region: 'ES', locale: 'es' }
