// ============================================================
// Respuestas de TMDB con la forma de la API oficial v3 (recortadas a los
// campos que usa el progreso, más algunos de contexto). El proxy de este
// entorno bloquea TMDB: estas fixtures sustituyen a la red en los tests; el
// guion `scripts/verify-progress.mjs` lo comprueba contra producción.
//   GET /tv/{series_id}                  developer.themoviedb.org/reference/tv-series-details
//   GET /tv/{series_id}/season/{n}       developer.themoviedb.org/reference/tv-season-details
// ============================================================

/** Juego de tronos (1399): terminada, 8 temporadas + especiales (season 0). */
export const TV_GOT = {
  id: 1399,
  name: 'Juego de tronos',
  original_name: 'Game of Thrones',
  first_air_date: '2011-04-17',
  in_production: false,
  status: 'Ended',
  number_of_episodes: 73,
  number_of_seasons: 8,
  last_episode_to_air: {
    id: 1551830,
    name: 'El trono de hierro',
    air_date: '2019-05-19',
    episode_number: 6,
    episode_type: 'finale',
    season_number: 8,
    show_id: 1399,
    runtime: 80,
  },
  next_episode_to_air: null,
  seasons: [
    { air_date: '2010-12-05', episode_count: 14, id: 3627, name: 'Especiales', season_number: 0 },
    { air_date: '2011-04-17', episode_count: 10, id: 3624, name: 'Temporada 1', season_number: 1 },
    { air_date: '2012-04-01', episode_count: 10, id: 3625, name: 'Temporada 2', season_number: 2 },
    { air_date: '2013-03-31', episode_count: 10, id: 3626, name: 'Temporada 3', season_number: 3 },
    { air_date: '2014-04-06', episode_count: 10, id: 3628, name: 'Temporada 4', season_number: 4 },
    { air_date: '2015-04-12', episode_count: 10, id: 62090, name: 'Temporada 5', season_number: 5 },
    { air_date: '2016-04-24', episode_count: 10, id: 71881, name: 'Temporada 6', season_number: 6 },
    { air_date: '2017-07-16', episode_count: 7, id: 81266, name: 'Temporada 7', season_number: 7 },
    { air_date: '2019-04-14', episode_count: 6, id: 107971, name: 'Temporada 8', season_number: 8 },
  ],
}

/** The Last of Us (100088): en emisión, 2 temporadas emitidas, sin próximo. */
export const TV_TLOU = {
  id: 100088,
  name: 'The Last of Us',
  first_air_date: '2023-01-15',
  in_production: true,
  status: 'Returning Series',
  number_of_episodes: 16,
  number_of_seasons: 2,
  last_episode_to_air: {
    id: 5730124,
    name: 'Convergence',
    air_date: '2025-05-25',
    episode_number: 7,
    episode_type: 'finale',
    season_number: 2,
    show_id: 100088,
  },
  next_episode_to_air: null,
  seasons: [
    { air_date: '2023-01-15', episode_count: 9, id: 144593, name: 'Temporada 1', season_number: 1 },
    { air_date: '2025-04-13', episode_count: 7, id: 396416, name: 'Temporada 2', season_number: 2 },
  ],
}

/** GET /tv/1399/season/1 (es-ES). */
export const TV_GOT_S1 = {
  _id: '5256c89f19c2956ff6046d47',
  air_date: '2011-04-17',
  name: 'Temporada 1',
  id: 3624,
  season_number: 1,
  episodes: [
    'Se acerca el invierno',
    'El camino real',
    'Lord Nieve',
    'Tullidos, bastardos y cosas rotas',
    'El lobo y el león',
    'Una corona de oro',
    'Ganas o mueres',
    'Por el lado de la punta',
    'Baelor',
    'Fuego y sangre',
  ].map((name, i) => ({
    // Semanal desde el 17-04-2011 (como en TMDB).
    air_date: new Date(Date.UTC(2011, 3, 17 + i * 7)).toISOString().slice(0, 10),
    episode_number: i + 1,
    episode_type: i === 9 ? 'finale' : 'standard',
    id: 63056 + i,
    name,
    season_number: 1,
    show_id: 1399,
    runtime: 60,
  })),
}

/** RAWG GET /api/games/{id}: Hades (`playtime` = horas medias). */
export const RAWG_HADES = {
  id: 274755,
  slug: 'hades-2',
  name: 'Hades',
  released: '2020-09-17',
  background_image: 'https://media.rawg.io/media/games/1f4/1f47a270b8f241e4676b14d39ec620f7.jpg',
  rating: 4.4,
  ratings_count: 2000,
  metacritic: 93,
  playtime: 22,
  description_raw: 'Desafía al dios de los muertos.',
  genres: [{ id: 4, name: 'Action' }],
  platforms: [{ platform: { id: 4, name: 'PC' } }],
  tags: [{ id: 31, slug: 'singleplayer' }],
}

/** AniList Media (anime): Cowboy Bebop. */
export const ANILIST_BEBOP = {
  id: 1,
  title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop', native: 'カウボーイビバップ' },
  coverImage: { large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1.jpg' },
  seasonYear: 1998,
  description: 'Spike y Jet…',
  genres: ['Action'],
  averageScore: 86,
  episodes: 26,
  status: 'FINISHED',
  studios: { nodes: [{ name: 'Sunrise' }] },
}
