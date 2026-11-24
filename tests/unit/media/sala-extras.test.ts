// ============================================================
// Fase 8.5 · F5b: la apaisada sin rótulo de TMDB para la sala.
//
// Sin red: `fetch` devuelve respuestas fijas. Se comprueba la petición
// (`include_image_language=null`), la elección (sin idioma, la mejor votada,
// nada estrecho ni con ruta rara) y que la URL es la de `image.tmdb.org`
// (carga directa, sin optimizador ni copia).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// F5c: el cruce con Wikidata se prueba en `anime-tmdb-cross.test.ts`; aquí, fijo.
const cross = vi.hoisted(() => ({ value: null as null | { kind: "movie" | "tv"; id: number; scope: "full" | "image" } }));
vi.mock("@/lib/media/anime-tmdb-cross", () => ({ findAnimeTmdbCross: async () => cross.value }));
import { getTmdbImages, tmdbTextlessBackdrop } from "@/lib/api/tmdb";
import { loadSalaFichaExtras, tmdbRefOf } from "@/lib/media/sala-extras";
import { salaItemOf } from "@/lib/media/sala-item";
import { resetProviderCircuits } from "@/lib/api/http";
import type { MediaItem } from "@/types/media";

function respond(body: unknown, status = 200) {
  const spy = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body, headers: new Headers() });
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  resetProviderCircuits();
  cross.value = null;
});
afterEach(() => vi.unstubAllGlobals());

const ctx = { locale: "es", hasTrailer: false, hasProviders: false };
const movie: MediaItem = { id: "movie_129", externalId: "129", type: "movie", title: "El viaje de Chihiro" };

describe("tmdbTextlessBackdrop", () => {
  it("se queda con la sin idioma mejor votada, en w1280 de image.tmdb.org", () => {
    const url = tmdbTextlessBackdrop({
      backdrops: [
        { file_path: "/con-rotulo.jpg", iso_639_1: "es", vote_average: 9, width: 1920 },
        { file_path: "/b.jpg", iso_639_1: null, vote_average: 5.2, vote_count: 3, width: 1920 },
        { file_path: "/a.jpg", iso_639_1: null, vote_average: 5.6, vote_count: 1, width: 3840 },
        { file_path: "/c.jpg", iso_639_1: null, vote_average: 5.6, vote_count: 0, width: 1920 },
      ],
    });
    expect(url).toBe("https://image.tmdb.org/t/p/w1280/a.jpg");
  });

  it("sin ninguna sin rótulo, nada (la sala sigue con la de siempre)", () => {
    expect(tmdbTextlessBackdrop({ backdrops: [{ file_path: "/x.jpg", iso_639_1: "en" }] })).toBeUndefined();
    expect(tmdbTextlessBackdrop({})).toBeUndefined();
    expect(tmdbTextlessBackdrop(null)).toBeUndefined();
  });

  it("descarta rutas raras y apaisadas estrechas", () => {
    expect(
      tmdbTextlessBackdrop({
        backdrops: [
          { file_path: "https://otro.example/x.jpg", iso_639_1: null },
          { file_path: "/../x.jpg", iso_639_1: null },
          { file_path: "/estrecha.jpg", iso_639_1: null, width: 780 },
        ],
      })
    ).toBeUndefined();
  });
});

describe("getTmdbImages", () => {
  it("pide /images con include_image_language=null", async () => {
    const spy = respond({ backdrops: [] });
    await getTmdbImages("tv", 209867);
    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.hostname).toBe("api.themoviedb.org");
    expect(url.pathname).toBe("/3/tv/209867/images");
    expect(url.searchParams.get("include_image_language")).toBe("null");
  });
});

describe("tmdbRefOf", () => {
  it("película, serie y anime de TMDB; nada para AniList ni para otros tipos", () => {
    expect(tmdbRefOf(movie)).toEqual({ kind: "movie", id: 129 });
    expect(tmdbRefOf({ type: "tv", externalId: "1399" })).toEqual({ kind: "tv", id: 1399 });
    expect(tmdbRefOf({ type: "anime", externalId: "tmdb-209867" })).toEqual({ kind: "tv", id: 209867 });
    expect(tmdbRefOf({ type: "anime", externalId: "al-154587" })).toBeNull();
    expect(tmdbRefOf({ type: "book", externalId: "123" })).toBeNull();
    expect(tmdbRefOf({ type: "movie", externalId: "abc" })).toBeNull();
  });
});

describe("loadSalaFichaExtras", () => {
  it("con apaisada sin rótulo, la devuelve", async () => {
    respond({ backdrops: [{ file_path: "/sin.jpg", iso_639_1: null, width: 1920 }] });
    await expect(loadSalaFichaExtras(movie, ctx)).resolves.toEqual({
      backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg",
    });
  });

  it("TMDB caído: nada, sin lanzar", async () => {
    respond({}, 503);
    await expect(loadSalaFichaExtras(movie, ctx)).resolves.toEqual({});
  });

  it("un tipo sin TMDB: no llama a nadie", async () => {
    const spy = respond({ backdrops: [] });
    await expect(
      loadSalaFichaExtras({ id: "anime_tv-1", externalId: "1", type: "manga", title: "Sin TMDB" }, ctx)
    ).resolves.toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("salaItemOf", () => {
  it("cambia la apaisada solo si llega una; el resto, igual", () => {
    const item = { ...movie, backdrop: "https://image.tmdb.org/t/p/w1280/de-siempre.jpg" };
    expect(salaItemOf(item, null)).toBe(item);
    expect(salaItemOf(item, {})).toBe(item);
    expect(salaItemOf(item, { backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg" })).toEqual({
      ...item,
      backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg",
    });
  });
});

// ── F5c: anime de AniList cruzado con TMDB ───────────────────────────────────

describe("loadSalaFichaExtras · anime de AniList (F5c)", () => {
  const frieren: MediaItem = { id: "anime_al-154587", externalId: "al-154587", type: "anime", title: "Frieren" };
  const TV_DETAIL = {
    id: 209867,
    name: "Frieren",
    backdrop_path: "/con-rotulo.jpg",
    first_air_date: "2023-09-29",
    videos: { results: [{ site: "YouTube", type: "Trailer", key: "qgQ0CmwbaRs" }] },
    "watch/providers": {
      results: {
        ES: {
          link: "https://www.themoviedb.org/tv/209867/watch?locale=ES",
          flatrate: [{ provider_name: "Crunchyroll", logo_path: "/cr.jpg" }],
        },
      },
    },
  };

  function tmdb() {
    const spy = vi.fn(async (input: string) => {
      const path = new URL(input).pathname;
      const body =
        path === "/3/tv/209867/images"
          ? { backdrops: [{ file_path: "/sin.jpg", iso_639_1: null, width: 1920 }] }
          : path === "/3/tv/209867"
            ? TV_DETAIL
            : null;
      return new Response(JSON.stringify(body ?? {}), { status: body ? 200 : 404 });
    });
    vi.stubGlobal("fetch", spy);
    return spy;
  }

  it("sin cruce: nada (ni se pide TMDB)", async () => {
    const spy = tmdb();
    await expect(loadSalaFichaExtras(frieren, ctx)).resolves.toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });

  it("primera temporada: imagen sin rótulo, tráiler y «Dónde ver» de TMDB, y la segunda fuente", async () => {
    tmdb();
    cross.value = { kind: "tv", id: 209867, scope: "full" };
    await expect(loadSalaFichaExtras(frieren, ctx)).resolves.toEqual({
      backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg",
      trailerKey: "qgQ0CmwbaRs",
      providers: [{ name: "Crunchyroll", logoPath: "https://image.tmdb.org/t/p/w92/cr.jpg", type: "flatrate" }],
      watchLink: "https://www.themoviedb.org/tv/209867/watch?locale=ES",
      extraSource: { name: "TMDB", url: "https://www.themoviedb.org/tv/209867", imageOnly: false },
    });
  });

  it("si AniList ya trae tráiler y hay «Dónde ver», solo la imagen", async () => {
    tmdb();
    cross.value = { kind: "tv", id: 209867, scope: "full" };
    await expect(loadSalaFichaExtras(frieren, { locale: "es", hasTrailer: true, hasProviders: true })).resolves.toEqual({
      backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg",
      extraSource: { name: "TMDB", url: "https://www.themoviedb.org/tv/209867", imageOnly: true },
    });
  });

  it("temporada 2: de TMDB solo la imagen (ni tráiler ni «Dónde ver»)", async () => {
    tmdb();
    cross.value = { kind: "tv", id: 209867, scope: "image" };
    const extras = await loadSalaFichaExtras({ ...frieren, id: "anime_al-182255", externalId: "al-182255" }, ctx);
    expect(extras).toEqual({
      backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg",
      extraSource: { name: "TMDB", url: "https://www.themoviedb.org/tv/209867", imageOnly: true },
    });
  });

  it("TMDB caído tras el cruce: nada, sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    cross.value = { kind: "tv", id: 209867, scope: "full" };
    await expect(loadSalaFichaExtras(frieren, ctx)).resolves.toEqual({});
  });
});
