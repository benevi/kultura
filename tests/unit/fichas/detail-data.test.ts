// ============================================================
// F-15 · Datos de la ficha: una llamada por película, "dónde ver" completo,
// anime cruzado con TMDB, géneros traducidos y nada cacheado si falla.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getMovie: vi.fn(),
  getMovieVideos: vi.fn(),
  getMovieProviders: vi.fn(),
  getTV: vi.fn(),
  getTVProviders: vi.fn(),
  getAnimeAniList: vi.fn(),
  searchAnimeTmdb: vi.fn(),
  getAnimeTmdb: vi.fn(),
  getGame: vi.fn(),
  getSteamInfoForGame: vi.fn(),
  getComic: vi.fn(),
  cacheCalls: [] as unknown[][],
}));

// La caché de datos de Next: se registra la llamada y se ejecuta la función.
vi.mock("next/cache", () => ({
  unstable_cache:
    <T extends (...a: unknown[]) => unknown>(fn: T, keys: string[], opts: unknown) =>
    (...args: unknown[]) => {
      mocks.cacheCalls.push([keys, opts, args]);
      return fn(...args);
    },
}));
vi.mock("@/lib/api/tmdb", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/tmdb")>()),
  getMovie: mocks.getMovie,
  getMovieVideos: mocks.getMovieVideos,
  getMovieProviders: mocks.getMovieProviders,
  getTV: mocks.getTV,
  getTVProviders: mocks.getTVProviders,
}));
vi.mock("@/lib/api/anilist", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/anilist")>()),
  getAnime: mocks.getAnimeAniList,
}));
vi.mock("@/lib/api/anime-tmdb", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/anime-tmdb")>()),
  searchAnimeTmdb: mocks.searchAnimeTmdb,
  getAnimeTmdb: mocks.getAnimeTmdb,
}));
vi.mock("@/lib/api/rawg", () => ({ getGame: mocks.getGame }));
vi.mock("@/lib/api/steam", () => ({ getSteamInfoForGame: mocks.getSteamInfoForGame }));
vi.mock("@/lib/api/comicvine", () => ({ getComic: mocks.getComic }));

import { loadMediaDetail, MEDIA_DETAIL_REVALIDATE_SECONDS } from "@/lib/media/detail-data";
import { extractWatchOffer, titleMatchKey } from "@/lib/media/watch-providers";

const ES_LINK = "https://www.themoviedb.org/movie/550-fight-club/watch?locale=ES";

const fightClub = {
  id: 550,
  title: "El club de la lucha",
  original_title: "Fight Club",
  poster_path: "/p.jpg",
  backdrop_path: "/b.jpg",
  release_date: "1999-10-15",
  overview: "Un oficinista insomne…",
  vote_average: 8.4,
  runtime: 139,
  genres: [
    { id: 18, name: "Drama" },
    { id: 53, name: "Thriller" },
  ],
  credits: { crew: [{ job: "Director", name: "David Fincher" }], cast: [{ name: "Brad Pitt" }] },
  videos: { results: [{ site: "YouTube", type: "Trailer", key: "yt-key" }] },
  "watch/providers": {
    results: {
      ES: {
        link: ES_LINK,
        flatrate: [{ provider_name: "Disney Plus", logo_path: "/d.jpg" }],
        rent: [{ provider_name: "Apple TV", logo_path: "/a.jpg" }],
        buy: [
          { provider_name: "Apple TV", logo_path: "/a.jpg" },
          { provider_name: "Apple TV", logo_path: "/a.jpg" },
        ],
      },
      US: { link: "https://www.themoviedb.org/movie/550/watch?locale=US", flatrate: [{ provider_name: "Hulu", logo_path: "/h.jpg" }] },
    },
  },
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => (typeof m === "function" && "mockReset" in m ? m.mockReset() : null));
  mocks.cacheCalls.length = 0;
  mocks.getSteamInfoForGame.mockResolvedValue(null);
});

describe("loadMediaDetail", () => {
  it("película: UNA llamada a TMDB (tráiler y 'dónde ver' vienen en la ficha)", async () => {
    mocks.getMovie.mockResolvedValue(fightClub);
    const data = await loadMediaDetail("movie", "550", "es");
    expect(mocks.getMovie).toHaveBeenCalledTimes(1);
    expect(mocks.getMovie).toHaveBeenCalledWith(550, "es");
    expect(mocks.getMovieVideos).not.toHaveBeenCalled();
    expect(mocks.getMovieProviders).not.toHaveBeenCalled();
    expect(data?.trailerKey).toBe("yt-key");
    expect(data?.watchLink).toBe(ES_LINK);
    expect(data?.source).toEqual({ name: "TMDB", url: "https://www.themoviedb.org/movie/550" });
  });

  it("'dónde ver' de España en /es: suscripción, alquiler y compra, sin repetidos y logos pequeños", async () => {
    mocks.getMovie.mockResolvedValue(fightClub);
    const data = await loadMediaDetail("movie", "550", "es");
    expect(data?.providers.map((p) => `${p.type}:${p.name}`)).toEqual([
      "flatrate:Disney Plus",
      "rent:Apple TV",
      "buy:Apple TV",
    ]);
    expect(data?.providers[0].logoPath).toBe("https://image.tmdb.org/t/p/w92/d.jpg");
  });

  it("en /en la oferta y el enlace son los de EE. UU.", async () => {
    mocks.getMovie.mockResolvedValue(fightClub);
    const data = await loadMediaDetail("movie", "550", "en");
    expect(data?.providers.map((p) => p.name)).toEqual(["Hulu"]);
    expect(data?.watchLink).toBe("https://www.themoviedb.org/movie/550/watch?locale=US");
  });

  it("géneros en el idioma de la página (F-06) sin tocar los del proveedor", async () => {
    mocks.getMovie.mockResolvedValue(fightClub);
    const es = await loadMediaDetail("movie", "550", "es");
    expect(es?.item.genres).toEqual(["Drama", "Thriller"]);
    expect(es?.genreLabels).toContain("Suspense");
  });

  it("se guarda 24 h, con tipo, id e idioma en la clave", async () => {
    mocks.getMovie.mockResolvedValue(fightClub);
    await loadMediaDetail("movie", "550", "en");
    const call = mocks.cacheCalls.find(([, , args]) => JSON.stringify(args) === '["movie","550","en"]');
    expect(call?.[1]).toMatchObject({ revalidate: MEDIA_DETAIL_REVALIDATE_SECONDS });
    expect(MEDIA_DETAIL_REVALIDATE_SECONDS).toBe(86400);
  });

  it("un id con forma imposible → null sin llamar a nadie ni ocupar caché", async () => {
    expect(await loadMediaDetail("movie", "abc", "es")).toBeNull();
    expect(await loadMediaDetail("podcast", "1", "es")).toBeNull();
    expect(await loadMediaDetail("comic", "1/../../x", "es")).toBeNull();
    expect(mocks.getMovie).not.toHaveBeenCalled();
    expect(mocks.getComic).not.toHaveBeenCalled();
    expect(mocks.cacheCalls).toHaveLength(0);
  });

  it("si el proveedor falla → null (y se lanza dentro de la caché: no se guarda)", async () => {
    mocks.getMovie.mockRejectedValue(new Error("TMDB 404"));
    expect(await loadMediaDetail("movie", "999999", "es")).toBeNull();
  });

  it("marca como adulto lo que dice nsfw-filter", async () => {
    mocks.getMovie.mockResolvedValue({ ...fightClub, genres: [{ id: 1, name: "Adult" }] });
    expect((await loadMediaDetail("movie", "550", "es"))?.nsfw).toBe(true);
    mocks.getMovie.mockResolvedValue(fightClub);
    expect((await loadMediaDetail("movie", "550", "es"))?.nsfw).toBe(false);
  });

  it("juego: enlace a su página de RAWG con el slug y datos de Steam", async () => {
    mocks.getGame.mockResolvedValue({
      id: 3498,
      slug: "grand-theft-auto-v",
      name: "GTA V",
      background_image: "https://media.rawg.io/media/games/x.jpg",
      released: "2013-09-17",
      rating: 4.47,
      metacritic: 92,
      genres: [{ name: "Action" }],
    });
    mocks.getSteamInfoForGame.mockResolvedValue({ appId: 271590 });
    const data = await loadMediaDetail("game", "3498", "es");
    expect(data?.source).toEqual({ name: "RAWG", url: "https://rawg.io/games/grand-theft-auto-v" });
    expect(data?.steam).toEqual({ appId: 271590 });
  });

  // PRO-6: el anime de AniList no traía "dónde ver".
  it("anime de AniList: 'dónde ver' de la serie de TMDB con el MISMO título japonés", async () => {
    mocks.getAnimeAniList.mockResolvedValue({
      id: 16498,
      title: { english: "Attack on Titan", romaji: "Shingeki no Kyojin", native: "進撃の巨人" },
      coverImage: { large: "https://s4.anilist.co/x.jpg" },
      seasonYear: 2013,
      description: "Humanity…",
      genres: ["Action"],
      averageScore: 85,
      episodes: 25,
    });
    mocks.searchAnimeTmdb.mockImplementation(async (q: string) => ({
      totalPages: 1,
      items:
        q === "Shingeki no Kyojin"
          ? [
              { id: "anime_tmdb-1", externalId: "tmdb-1", type: "anime", title: "Otra", originalTitle: "別の作品" },
              { id: "anime_tmdb-1429", externalId: "tmdb-1429", type: "anime", title: "Ataque a los titanes", originalTitle: "進撃の巨人" },
            ]
          : [],
    }));
    mocks.getTVProviders.mockResolvedValue({
      results: { ES: { link: "https://www.themoviedb.org/tv/1429/watch?locale=ES", flatrate: [{ provider_name: "Crunchyroll", logo_path: "/c.jpg" }] } },
    });
    const data = await loadMediaDetail("anime", "al-16498", "es");
    expect(mocks.getTVProviders).toHaveBeenCalledWith(1429, "ES", "es");
    expect(data?.providers.map((p) => p.name)).toEqual(["Crunchyroll"]);
    expect(data?.watchLink).toBe("https://www.themoviedb.org/tv/1429/watch?locale=ES");
    expect(data?.source?.url).toBe("https://anilist.co/anime/16498");
  });

  it("anime sin pareja exacta en TMDB: sin 'dónde ver' (mejor nada que la oferta de otra obra)", async () => {
    mocks.getAnimeAniList.mockResolvedValue({
      id: 1,
      title: { english: "X", romaji: "X", native: "エックス" },
      genres: [],
    });
    mocks.searchAnimeTmdb.mockResolvedValue({
      totalPages: 1,
      items: [{ id: "anime_tmdb-5", externalId: "tmdb-5", type: "anime", title: "X", originalTitle: "別" }],
    });
    const data = await loadMediaDetail("anime", "al-1", "es");
    expect(mocks.getTVProviders).not.toHaveBeenCalled();
    expect(data?.providers).toEqual([]);
  });

  it("anime servido por TMDB: usa su propio id, sin buscar", async () => {
    mocks.getAnimeTmdb.mockResolvedValue({
      item: { id: "anime_tmdb-1429", externalId: "tmdb-1429", type: "anime", title: "Ataque a los titanes" },
    });
    mocks.getTVProviders.mockResolvedValue({ results: {} });
    await loadMediaDetail("anime", "tmdb-1429", "es");
    expect(mocks.searchAnimeTmdb).not.toHaveBeenCalled();
    expect(mocks.getTVProviders).toHaveBeenCalledWith(1429, "ES", "es");
  });

  it("si falla 'dónde ver' del anime, la ficha sale igual", async () => {
    mocks.getAnimeTmdb.mockResolvedValue({
      item: { id: "anime_tmdb-1429", externalId: "tmdb-1429", type: "anime", title: "T" },
    });
    mocks.getTVProviders.mockRejectedValue(new Error("TMDB caído"));
    const data = await loadMediaDetail("anime", "tmdb-1429", "es");
    expect(data?.item.title).toBe("T");
    expect(data?.providers).toEqual([]);
  });
});

describe("extractWatchOffer", () => {
  it("incluye gratis y con anuncios, y descarta entradas sin logo", () => {
    const offer = extractWatchOffer(
      {
        results: {
          ES: {
            free: [{ provider_name: "RTVE Play", logo_path: "/r.jpg" }],
            ads: [{ provider_name: "Pluto TV", logo_path: "/p.jpg" }],
            flatrate: [{ provider_name: "Sin logo", logo_path: "" }],
          } as never,
        },
      },
      "ES"
    );
    expect(offer.providers.map((p) => `${p.type}:${p.name}`)).toEqual(["free:RTVE Play", "ads:Pluto TV"]);
    expect(offer.link).toBeUndefined();
  });

  it("no enlaza a un dominio que no sea TMDB", () => {
    expect(extractWatchOffer({ results: { ES: { link: "https://evil.test/x" } } }, "ES").link).toBeUndefined();
  });

  it("país sin oferta → vacío", () => {
    expect(extractWatchOffer({ results: {} }, "ES")).toEqual({ providers: [] });
    expect(extractWatchOffer(undefined, "ES")).toEqual({ providers: [] });
  });
});

describe("titleMatchKey", () => {
  it("compara sin espacios, puntuación ni anchura", () => {
    expect(titleMatchKey("進撃の巨人：The Final")).toBe(titleMatchKey("進撃の巨人 the final"));
    expect(titleMatchKey("ＡＢＣ")).toBe("abc");
  });
});
