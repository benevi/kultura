// ============================================================
// KULTURA — Normalizer unit tests
// Fixtures hardcodeadas que simulan respuestas de API.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeMangaJikan,
  normalizeMangaDex,
  normalizeBookGoogle,
  normalizeBookOpenLibrary,
  normalizeGame,
} from "@/lib/api/normalizer";
import type { TmdbMovieDetail, TmdbTVDetail, TmdbProvidersResponse } from "@/lib/api/tmdb";
import type { JikanAnimeDetail, JikanMangaDetail } from "@/lib/api/jikan";
import type { MangaDexManga } from "@/lib/api/mangadex";
import type { GoogleBooksVolume } from "@/lib/api/googlebooks";
import type { OpenLibraryDoc } from "@/lib/api/openlibrary";
import type { RawgGame } from "@/lib/api/rawg";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TMDB_MOVIE_FIXTURE: TmdbMovieDetail = {
  id: 550,
  title: "El club de la lucha",
  original_title: "Fight Club",
  poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  backdrop_path: "/rr7E0NoGKxvbkb89eR1GwfoYjpA.jpg",
  release_date: "1999-10-15",
  overview: "Un insomne sin nombre y un vendedor de jabón forman un club de lucha.",
  vote_average: 8.4,
  genres: [{ id: 18, name: "Drama" }, { id: 53, name: "Thriller" }],
  runtime: 139,
  credits: {
    crew: [{ job: "Director", name: "David Fincher" }, { job: "Producer", name: "Art Linson" }],
    cast: [{ name: "Brad Pitt" }, { name: "Edward Norton" }],
  },
  videos: {
    results: [
      { key: "SUXWAEX2jlg", site: "YouTube", type: "Trailer" },
    ],
  },
};

const TMDB_TV_FIXTURE: TmdbTVDetail = {
  id: 1396,
  name: "Breaking Bad",
  original_name: "Breaking Bad",
  poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  backdrop_path: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  first_air_date: "2008-01-20",
  overview: "Un profesor de química con cáncer terminal se convierte en fabricante de drogas.",
  vote_average: 9.5,
  genres: [{ id: 18, name: "Drama" }, { id: 80, name: "Crime" }],
  number_of_episodes: 62,
  number_of_seasons: 5,
  networks: [{ name: "AMC" }],
  status: "Ended",
  credits: {
    crew: [],
    cast: [{ name: "Bryan Cranston" }, { name: "Aaron Paul" }],
  },
  videos: { results: [] },
};

const JIKAN_ANIME_FIXTURE: JikanAnimeDetail = {
  mal_id: 1535,
  title: "Death Note",
  title_english: "Death Note",
  images: { jpg: { large_image_url: "https://cdn.myanimelist.net/images/anime/9/9453l.jpg" } },
  synopsis: "Un cuaderno que permite matar a cualquiera cuyo nombre esté escrito en él.",
  score: 8.62,
  genres: [{ name: "Mystery" }, { name: "Supernatural" }, { name: "Thriller" }],
  year: 2006,
  episodes: 37,
  status: "Finished Airing",
  studios: [{ name: "Madhouse" }],
  source: "Manga",
  trailer: { youtube_id: "NlJZ-YgAt-c" },
};

const JIKAN_ANIME_MINIMAL: JikanAnimeDetail = {
  mal_id: 9999,
  title: "Unknown Anime",
  title_english: null,
  images: { jpg: { large_image_url: "" } },
  synopsis: null,
  score: null,
  genres: [],
  year: null,
  episodes: null,
  status: "Unknown",
  studios: [],
  source: "Unknown",
  trailer: { youtube_id: null },
};

const JIKAN_MANGA_FIXTURE: JikanMangaDetail = {
  mal_id: 2,
  title: "Berserk",
  images: { jpg: { large_image_url: "https://cdn.myanimelist.net/images/manga/1/157897l.jpg" } },
  synopsis: "La oscura historia de Guts, un guerrero solitario.",
  score: 9.47,
  genres: [{ name: "Action" }, { name: "Adventure" }, { name: "Fantasy" }],
  published: { prop: { from: { year: 1989 } } },
  chapters: null,
  volumes: 41,
  status: "Publishing",
  authors: [{ name: "Miura, Kentarou" }],
};

const MANGADEX_FIXTURE: MangaDexManga = {
  id: "a96676be-9d0c-4a94-ae74-306753c80c1c",
  attributes: {
    title: { en: "One Piece", ja: "ワンピース" },
    description: { en: "The story of Monkey D. Luffy searching for the One Piece treasure." },
    year: 1997,
    status: "ongoing",
    tags: [
      { attributes: { name: { en: "Adventure" }, group: "genre" } },
      { attributes: { name: { en: "Action" }, group: "genre" } },
      { attributes: { name: { en: "Shounen" }, group: "theme" } },
    ],
    lastChapter: null,
    lastVolume: null,
  },
  relationships: [
    {
      type: "cover_art",
      id: "cover-id-123",
      attributes: { fileName: "cover.jpg" },
    },
  ],
};

const GOOGLE_BOOKS_FIXTURE: GoogleBooksVolume = {
  id: "aGbQEAAAQBAJ",
  volumeInfo: {
    title: "Cien años de soledad",
    authors: ["Gabriel García Márquez"],
    description: "La historia de la familia Buendía a lo largo de siete generaciones.",
    publishedDate: "1967-05-30",
    pageCount: 417,
    categories: ["Fiction", "Latin American fiction"],
    imageLinks: {
      thumbnail: "http://books.google.com/books/content?id=aGbQEAAAQBAJ&printsec=frontcover&img=1&zoom=1",
    },
    averageRating: 4.5,
    publisher: "Editorial Sudamericana",
    industryIdentifiers: [
      { type: "ISBN_13", identifier: "9780060883287" },
    ],
    language: "es",
  },
};

const OPEN_LIBRARY_FIXTURE: OpenLibraryDoc = {
  key: "/works/OL7353617W",
  title: "The Great Gatsby",
  author_name: ["F. Scott Fitzgerald"],
  first_publish_year: 1925,
  cover_i: 8231856,
  subject: ["American fiction", "Novels", "Jazz Age"],
};

const RAWG_FIXTURE: RawgGame = {
  id: 3498,
  name: "Grand Theft Auto V",
  background_image: "https://media.rawg.io/media/games/456/456dea5e1c7e3cd07060601f68f6f026.jpg",
  released: "2013-09-17",
  rating: 4.47,
  metacritic: 97,
  playtime: 74,
  genres: [{ name: "Action" }, { name: "Adventure" }],
  tags: [
    { name: "Singleplayer", slug: "singleplayer" },
    { name: "Multiplayer", slug: "multiplayer" },
  ],
  description_raw: "An action-adventure game set in the fictional state of San Andreas.",
  platforms: [{ platform: { name: "PlayStation 4" } }, { platform: { name: "Xbox One" } }],
  developers: [{ name: "Rockstar North" }],
  publishers: [{ name: "Rockstar Games" }],
};

const RAWG_ZERO_RATING: RawgGame = {
  id: 9999,
  name: "Unknown Game",
  background_image: null,
  released: null,
  rating: 0,
  metacritic: null,
  genres: [],
};

// ── normalizeMovie ────────────────────────────────────────────────────────────

describe("normalizeMovie", () => {
  const result = normalizeMovie(TMDB_MOVIE_FIXTURE);

  it("produce id con formato correcto", () => {
    expect(result.id).toBe("movie_550");
  });

  it("externalId es siempre string", () => {
    expect(result.externalId).toBe("550");
    expect(typeof result.externalId).toBe("string");
  });

  it("tipo es movie", () => {
    expect(result.type).toBe("movie");
  });

  it("title es el título localizado", () => {
    expect(result.title).toBe("El club de la lucha");
  });

  it("originalTitle se incluye cuando difiere", () => {
    expect(result.originalTitle).toBe("Fight Club");
  });

  it("poster es URL completa con image.tmdb.org", () => {
    expect(result.poster).toBeDefined();
    expect(result.poster).toContain("image.tmdb.org");
    expect(result.poster).toContain("/w500/");
  });

  it("backdrop es URL completa con w1280", () => {
    expect(result.backdrop).toBeDefined();
    expect(result.backdrop).toContain("/w1280/");
  });

  it("year extrae solo el número de 4 dígitos", () => {
    expect(result.year).toBe(1999);
  });

  it("rating es el vote_average de TMDB (0-10)", () => {
    expect(result.rating).toBe(8.4);
  });

  it("ratingSource es TMDB", () => {
    expect(result.ratingSource).toBe("TMDB");
  });

  it("genres es array de strings", () => {
    expect(result.genres).toEqual(["Drama", "Thriller"]);
  });

  it("trailerKey extrae el YouTube key", () => {
    expect(result.trailerKey).toBe("SUXWAEX2jlg");
  });

  it("metadata incluye director y cast", () => {
    expect(result.metadata?.director).toBe("David Fincher");
    expect(Array.isArray(result.metadata?.cast)).toBe(true);
  });

  it("synopsis viene del overview", () => {
    expect(result.synopsis).toBeTruthy();
  });
});

describe("normalizeMovie — con providers", () => {
  const providersFixture: TmdbProvidersResponse = {
    results: {
      ES: {
        flatrate: [{ provider_name: "Netflix", logo_path: "/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg" }],
        rent: [{ provider_name: "Apple TV", logo_path: "/peURlLlr8jggOwK53fJ5wdQl05y.jpg" }],
      },
    },
  };

  const result = normalizeMovie(TMDB_MOVIE_FIXTURE, providersFixture);

  it("streamingProviders se extrae de la región ES", () => {
    expect(result.streamingProviders).toBeDefined();
    expect(result.streamingProviders!.length).toBeGreaterThan(0);
  });

  it("provider tiene name, logoPath y type", () => {
    const netflix = result.streamingProviders!.find((p) => p.name === "Netflix");
    expect(netflix).toBeDefined();
    expect(netflix!.type).toBe("flatrate");
    expect(netflix!.logoPath).toContain("image.tmdb.org");
  });
});

// ── normalizeTV ───────────────────────────────────────────────────────────────

describe("normalizeTV", () => {
  const result = normalizeTV(TMDB_TV_FIXTURE);

  it("produce id tv_*", () => {
    expect(result.id).toBe("tv_1396");
  });

  it("tipo es tv", () => {
    expect(result.type).toBe("tv");
  });

  it("title usa el campo name de TMDB TV", () => {
    expect(result.title).toBe("Breaking Bad");
  });

  it("year extrae de first_air_date", () => {
    expect(result.year).toBe(2008);
  });

  it("metadata incluye episodes y seasons", () => {
    expect(result.metadata?.episodes).toBe(62);
    expect(result.metadata?.seasons).toBe(5);
  });

  it("originalTitle es undefined cuando coincide con title", () => {
    expect(result.originalTitle).toBeUndefined();
  });
});

// ── normalizeAnime ────────────────────────────────────────────────────────────

describe("normalizeAnime", () => {
  const result = normalizeAnime(JIKAN_ANIME_FIXTURE);

  it("produce id anime_*", () => {
    expect(result.id).toBe("anime_1535");
  });

  it("tipo es anime", () => {
    expect(result.type).toBe("anime");
  });

  it("rating MAL se pasa tal cual (ya es 0-10)", () => {
    expect(result.rating).toBe(8.62);
  });

  it("ratingSource es MAL", () => {
    expect(result.ratingSource).toBe("MAL");
  });

  it("trailerKey extrae el youtube_id", () => {
    expect(result.trailerKey).toBe("NlJZ-YgAt-c");
  });

  it("genres es array de strings", () => {
    expect(result.genres).toContain("Mystery");
  });
});

describe("normalizeAnime — campos opcionales ausentes", () => {
  it("campos opcionales ausentes → undefined, no error", () => {
    const result = normalizeAnime(JIKAN_ANIME_MINIMAL);
    expect(result.id).toBe("anime_9999");
    expect(result.rating).toBeUndefined();
    expect(result.trailerKey).toBeUndefined();
    expect(result.synopsis).toBeUndefined();
    expect(result.year).toBeUndefined();
    expect(result.poster).toBeUndefined();
  });
});

// ── normalizeMangaJikan ───────────────────────────────────────────────────────

describe("normalizeMangaJikan", () => {
  const result = normalizeMangaJikan(JIKAN_MANGA_FIXTURE);

  it("produce id manga_*", () => {
    expect(result.id).toBe("manga_2");
  });

  it("tipo es manga", () => {
    expect(result.type).toBe("manga");
  });

  it("year extrae del published.prop.from.year", () => {
    expect(result.year).toBe(1989);
  });

  it("rating MAL se pasa tal cual", () => {
    expect(result.rating).toBe(9.47);
  });

  it("metadata incluye authors", () => {
    expect(result.metadata?.authors).toContain("Miura, Kentarou");
  });
});

// ── normalizeMangaDex ─────────────────────────────────────────────────────────

describe("normalizeMangaDex", () => {
  const result = normalizeMangaDex(MANGADEX_FIXTURE);

  it("produce id manga_* con UUID de MangaDex", () => {
    expect(result.id).toBe(`manga_${MANGADEX_FIXTURE.id}`);
  });

  it("tipo es manga", () => {
    expect(result.type).toBe("manga");
  });

  it("title prefiere inglés", () => {
    expect(result.title).toBe("One Piece");
  });

  it("poster usa cover_art relationship", () => {
    expect(result.poster).toContain("uploads.mangadex.org");
    expect(result.poster).toContain("cover.jpg");
  });

  it("genres filtra solo tags de grupo genre", () => {
    expect(result.genres).toContain("Adventure");
    expect(result.genres).toContain("Action");
    // "Shounen" es grupo "theme", no debe aparecer en genres
    expect(result.genres).not.toContain("Shounen");
  });

  it("year se extrae correctamente", () => {
    expect(result.year).toBe(1997);
  });
});

// ── normalizeBookGoogle ───────────────────────────────────────────────────────

describe("normalizeBookGoogle", () => {
  const result = normalizeBookGoogle(GOOGLE_BOOKS_FIXTURE);

  it("produce id book_*", () => {
    expect(result.id).toBe("book_aGbQEAAAQBAJ");
  });

  it("tipo es book", () => {
    expect(result.type).toBe("book");
  });

  it("rating Google 0-5 se multiplica por 2 para obtener 0-10", () => {
    expect(result.rating).toBe(9); // 4.5 * 2
  });

  it("ratingSource es Google Books", () => {
    expect(result.ratingSource).toBe("Google Books");
  });

  it("year extrae año de publishedDate", () => {
    expect(result.year).toBe(1967);
  });

  it("poster es la URL de thumbnail", () => {
    expect(result.poster).toContain("books.google.com");
  });

  it("metadata incluye authors y publisher", () => {
    expect(result.metadata?.authors).toContain("Gabriel García Márquez");
    expect(result.metadata?.publisher).toBe("Editorial Sudamericana");
  });

  it("metadata incluye ISBN", () => {
    expect(result.metadata?.isbn).toBe("9780060883287");
  });
});

// ── normalizeBookOpenLibrary ──────────────────────────────────────────────────

describe("normalizeBookOpenLibrary", () => {
  const result = normalizeBookOpenLibrary(OPEN_LIBRARY_FIXTURE);

  it("produce id book_* con el work ID sin prefijo /works/", () => {
    expect(result.id).toBe("book_OL7353617W");
  });

  it("externalId no incluye /works/ prefix", () => {
    expect(result.externalId).toBe("OL7353617W");
  });

  it("tipo es book", () => {
    expect(result.type).toBe("book");
  });

  it("poster usa cover_i para construir URL de Open Library", () => {
    expect(result.poster).toContain("covers.openlibrary.org");
    expect(result.poster).toContain("8231856");
  });

  it("year es first_publish_year", () => {
    expect(result.year).toBe(1925);
  });

  it("genres es subset de subjects", () => {
    expect(result.genres).toContain("American fiction");
  });
});

// ── normalizeGame ─────────────────────────────────────────────────────────────

describe("normalizeGame", () => {
  const result = normalizeGame(RAWG_FIXTURE);

  it("produce id game_*", () => {
    expect(result.id).toBe("game_3498");
  });

  it("externalId es siempre string", () => {
    expect(typeof result.externalId).toBe("string");
    expect(result.externalId).toBe("3498");
  });

  it("tipo es game", () => {
    expect(result.type).toBe("game");
  });

  it("rating RAWG 0-5 se multiplica por 2 para obtener 0-10", () => {
    // 4.47 * 2 = 8.94
    expect(result.rating).toBeCloseTo(8.94, 1);
  });

  it("ratingSource es RAWG", () => {
    expect(result.ratingSource).toBe("RAWG");
  });

  it("year extrae de released", () => {
    expect(result.year).toBe(2013);
  });

  it("poster es background_image", () => {
    expect(result.poster).toContain("rawg.io");
  });

  it("metadata incluye metacritic, platforms, developers, publishers", () => {
    expect(result.metadata?.metacritic).toBe(97);
    expect(result.metadata?.platforms).toContain("PlayStation 4");
    expect(result.metadata?.developers).toContain("Rockstar North");
    expect(result.metadata?.publishers).toContain("Rockstar Games");
  });

  it("metadata incluye playtime (horas) y tags (slugs) — R4c-1", () => {
    expect(result.metadata?.playtime).toBe(74);
    expect(result.metadata?.tags).toEqual(["singleplayer", "multiplayer"]);
  });
});

describe("normalizeGame — rating cero", () => {
  it("rating 0 se normaliza a undefined (sin datos)", () => {
    const result = normalizeGame(RAWG_ZERO_RATING);
    expect(result.rating).toBeUndefined();
    expect(result.ratingSource).toBeUndefined();
  });

  it("background_image null → poster undefined", () => {
    const result = normalizeGame(RAWG_ZERO_RATING);
    expect(result.poster).toBeUndefined();
  });
});

// ── ID format cross-check ─────────────────────────────────────────────────────

describe("formato de ID — todos los normalizadores", () => {
  it("normalizeMovie: id = movie_{externalId}", () => {
    const r = normalizeMovie(TMDB_MOVIE_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });

  it("normalizeTV: id = tv_{externalId}", () => {
    const r = normalizeTV(TMDB_TV_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });

  it("normalizeAnime: id = anime_{externalId}", () => {
    const r = normalizeAnime(JIKAN_ANIME_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });

  it("normalizeMangaJikan: id = manga_{externalId}", () => {
    const r = normalizeMangaJikan(JIKAN_MANGA_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });

  it("normalizeMangaDex: id = manga_{externalId}", () => {
    const r = normalizeMangaDex(MANGADEX_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });

  it("normalizeBookGoogle: id = book_{externalId}", () => {
    const r = normalizeBookGoogle(GOOGLE_BOOKS_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });

  it("normalizeBookOpenLibrary: id = book_{externalId}", () => {
    const r = normalizeBookOpenLibrary(OPEN_LIBRARY_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });

  it("normalizeGame: id = game_{externalId}", () => {
    const r = normalizeGame(RAWG_FIXTURE);
    expect(r.id).toBe(`${r.type}_${r.externalId}`);
  });
});
