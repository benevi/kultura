// ============================================================
// Respuestas de proveedores con la forma de su documentación oficial (F-26).
// El proxy de este entorno bloquea TMDB, AniList, Jikan y Open Library, así
// que los tests no pueden validar la forma real: estas fixtures copian los
// ejemplos documentados y `scripts/import-verify.sh` lo comprueba contra
// producción.
//   - TMDB `GET /3/find/{external_id}`: developer.themoviedb.org/reference/find-by-id
//   - TMDB `GET /3/search/movie`: developer.themoviedb.org/reference/search-movie
//   - AniList GraphQL `Page.media(idMal_in)`: docs.anilist.co (Media.idMal)
//   - Jikan v4 `GET /anime/{id}/full`: docs.api.jikan.moe
//   - Open Library `search.json?q=isbn:…`: openlibrary.org/dev/docs/api/search
// ============================================================

export const TMDB_FIND_IMDB_FIGHT_CLUB = {
  movie_results: [
    {
      adult: false,
      backdrop_path: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
      id: 550,
      title: 'Fight Club',
      original_language: 'en',
      original_title: 'Fight Club',
      overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression…',
      poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      media_type: 'movie',
      genre_ids: [18],
      popularity: 61.416,
      release_date: '1999-10-15',
      video: false,
      vote_average: 8.433,
      vote_count: 26280,
    },
  ],
  person_results: [],
  tv_results: [],
  tv_episode_results: [],
  tv_season_results: [],
}

export const TMDB_FIND_TVDB_BREAKING_BAD = {
  movie_results: [],
  person_results: [],
  tv_results: [
    {
      adult: false,
      backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
      id: 1396,
      name: 'Breaking Bad',
      original_language: 'en',
      original_name: 'Breaking Bad',
      overview: 'Walter White, a New Mexico chemistry teacher…',
      poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
      media_type: 'tv',
      genre_ids: [18, 80],
      popularity: 288.9,
      first_air_date: '2008-01-20',
      vote_average: 8.9,
      vote_count: 13000,
      origin_country: ['US'],
    },
  ],
  tv_episode_results: [],
  tv_season_results: [],
}

export const TMDB_FIND_EMPTY = {
  movie_results: [],
  person_results: [],
  tv_results: [],
  tv_episode_results: [],
  tv_season_results: [],
}

export const TMDB_GENRES_MOVIE = { genres: [{ id: 18, name: 'Drama' }, { id: 878, name: 'Science Fiction' }] }
export const TMDB_GENRES_TV = { genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }] }

/** Un resultado de `/search/movie` (misma forma que los de `/find`). */
export function tmdbMovie(id: number, title: string, releaseDate: string, extra: Record<string, unknown> = {}) {
  return {
    adult: false,
    backdrop_path: null,
    genre_ids: [18],
    id,
    original_language: 'en',
    original_title: title,
    overview: '',
    popularity: 10,
    poster_path: `/p${id}.jpg`,
    release_date: releaseDate,
    title,
    video: false,
    vote_average: 7,
    vote_count: 100,
    ...extra,
  }
}

export function tmdbSearch(results: unknown[]) {
  return { page: 1, results, total_pages: 1, total_results: results.length }
}

export const ANILIST_BY_MAL = {
  data: {
    Page: {
      media: [
        {
          id: 1,
          idMal: 1,
          isAdult: false,
          title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop', native: 'カウボーイビバップ' },
          coverImage: {
            extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-CXtrrkMpJ8Zq.png',
            large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1-CXtrrkMpJ8Zq.png',
          },
          description: 'Enter a world in the distant future…',
          genres: ['Action', 'Adventure', 'Drama', 'Sci-Fi'],
          averageScore: 86,
          seasonYear: 1998,
          startDate: { year: 1998 },
          episodes: 26,
          status: 'FINISHED',
          studios: { nodes: [{ name: 'Sunrise' }] },
          trailer: null,
          source: 'ORIGINAL',
        },
        {
          id: 9999,
          idMal: 666,
          isAdult: true,
          title: { romaji: 'Adulto', english: null, native: null },
          coverImage: { extraLarge: null, large: null },
          description: null,
          genres: ['Hentai'],
          averageScore: null,
          seasonYear: 2001,
          startDate: { year: 2001 },
          episodes: 2,
          status: 'FINISHED',
          studios: { nodes: [] },
          trailer: null,
          source: 'ORIGINAL',
        },
      ],
    },
  },
}

export const JIKAN_ANIME_5114 = {
  data: {
    mal_id: 5114,
    url: 'https://myanimelist.net/anime/5114/Fullmetal_Alchemist__Brotherhood',
    images: { jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg', large_image_url: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg' } },
    trailer: { youtube_id: '--IcmZkvL0Q' },
    title: 'Fullmetal Alchemist: Brotherhood',
    title_english: 'Fullmetal Alchemist: Brotherhood',
    type: 'TV',
    source: 'Manga',
    episodes: 64,
    status: 'Finished Airing',
    rating: 'R - 17+ (violence & profanity)',
    score: 9.1,
    synopsis: 'After a horrific alchemy experiment goes wrong…',
    year: 2009,
    studios: [{ mal_id: 4, type: 'anime', name: 'Bones' }],
    genres: [{ mal_id: 1, type: 'anime', name: 'Action' }],
  },
}

export const OPENLIBRARY_ISBN_HUNGER_GAMES = {
  numFound: 1,
  start: 0,
  numFoundExact: true,
  docs: [
    {
      key: '/works/OL5735363W',
      title: 'The Hunger Games',
      author_name: ['Suzanne Collins'],
      first_publish_year: 2008,
      cover_i: 12646537,
      language: ['eng', 'spa'],
      subject: ['Fiction', 'Survival'],
    },
  ],
}

export const OPENLIBRARY_TITLE_DUNE = {
  numFound: 3,
  start: 0,
  numFoundExact: true,
  docs: [
    { key: '/works/OL893415W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, cover_i: 11481354 },
    { key: '/works/OL1W', title: 'Dune', author_name: ['Otro Autor'], first_publish_year: 2010 },
    { key: '/works/OL2W', title: 'Dune Messiah', author_name: ['Frank Herbert'], first_publish_year: 1969 },
  ],
}
