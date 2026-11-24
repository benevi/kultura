// ============================================================
// Fase 8.5 · F5b: la apaisada sin rótulo de TMDB para la sala.
//
// Sin red: `fetch` devuelve respuestas fijas. Se comprueba la petición
// (`include_image_language=null`), la elección (sin idioma, la mejor votada,
// nada estrecho ni con ruta rara) y que la URL es la de `image.tmdb.org`
// (carga directa, sin optimizador ni copia).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

beforeEach(() => resetProviderCircuits());
afterEach(() => vi.unstubAllGlobals());

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
    await expect(loadSalaFichaExtras(movie)).resolves.toEqual({
      backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg",
    });
  });

  it("TMDB caído: nada, sin lanzar", async () => {
    respond({}, 503);
    await expect(loadSalaFichaExtras(movie)).resolves.toEqual({});
  });

  it("anime de AniList: no llama a nadie (eso es el cruce de F5c)", async () => {
    const spy = respond({ backdrops: [] });
    await expect(
      loadSalaFichaExtras({ id: "anime_al-1", externalId: "al-1", type: "anime", title: "Cowboy Bebop" })
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
