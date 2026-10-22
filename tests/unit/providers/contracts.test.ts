// ============================================================
// KULTURA — Contrato mínimo por proveedor (COD-1)
//
// Para cada uno de los nueve clientes: una respuesta 200 a la que le falta un
// campo obligatorio lanza `ProviderContractError` en modo `enforce` y NO se
// guarda en caché (la siguiente petición vuelve a salir a la red). Y la misma
// respuesta en modo `log` (el de producción la primera semana) se sirve como
// antes: el contrato no puede tumbar el catálogo.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "./cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import { ProviderContractError, resetProviderCircuits } from "@/lib/api/http";
import { getMovie, searchMovies } from "@/lib/api/tmdb";
import { getGame, searchGames } from "@/lib/api/rawg";
import { getAnime as getAniListAnime, searchAnime } from "@/lib/api/anilist";
import { getAnime as getJikanAnime } from "@/lib/api/jikan";
import { getComic, searchComics } from "@/lib/api/comicvine";
import { getManga, searchManga } from "@/lib/api/mangadex";
import { searchOpenLibrary } from "@/lib/api/openlibrary";
import { getGoogleBookDetail, searchGoogleBooks } from "@/lib/api/googlebooks";
import { getSteamAppDetails, searchSteamAppId } from "@/lib/api/steam";

const MANGA_ID = "a1c7c817-4e59-43b7-9365-09675a149a6f";

interface Case {
  name: string;
  call: () => Promise<unknown>;
  /** Respuesta 200 sin un campo obligatorio. */
  broken: unknown;
  /** Para los clientes que nunca lanzan (Steam): qué devuelven al romperse. */
  swallowed?: true;
}

const cases: Case[] = [
  { name: "TMDB listado sin results", call: () => searchMovies("x"), broken: { page: 1 } },
  { name: "TMDB ficha sin id", call: () => getMovie(550), broken: { title: "Fight Club" } },
  { name: "RAWG listado sin id", call: () => searchGames("x"), broken: { results: [{ name: "a" }] } },
  { name: "RAWG ficha sin name", call: () => getGame(1), broken: { id: 1 } },
  {
    name: "AniList página sin media",
    call: () => searchAnime("x"),
    broken: { data: { Page: { pageInfo: {} } } },
  },
  { name: "AniList ficha sin data", call: () => getAniListAnime(1), broken: {} },
  { name: "Jikan ficha sin mal_id", call: () => getJikanAnime(1), broken: { data: { title: "x" } } },
  {
    name: "ComicVine búsqueda sin results",
    call: () => searchComics("x"),
    broken: { status_code: 1, error: "OK" },
  },
  {
    name: "ComicVine ficha con id de texto",
    call: () => getComic("1"),
    broken: { status_code: 1, results: { id: "1" } },
  },
  {
    name: "MangaDex búsqueda sin relationships",
    call: () => searchManga("x"),
    broken: { data: [{ id: MANGA_ID, attributes: {} }] },
  },
  { name: "MangaDex ficha sin data", call: () => getManga(MANGA_ID), broken: { result: "ok" } },
  { name: "Open Library sin docs", call: () => searchOpenLibrary("x"), broken: { numFound: 3 } },
  {
    name: "Google Books volúmenes sin id",
    call: () => searchGoogleBooks("x"),
    broken: { totalItems: 1, items: [{ volumeInfo: {} }] },
  },
  { name: "Google Books ficha sin id", call: () => getGoogleBookDetail("abc"), broken: {} },
  {
    name: "Steam búsqueda con items que no es lista",
    call: () => searchSteamAppId("Hades"),
    broken: { items: "x" },
    swallowed: true,
  },
  {
    name: "Steam ficha con success de texto",
    call: () => getSteamAppDetails(1),
    broken: { "1": { success: "sí" } },
    swallowed: true,
  },
];

const respond = (body: unknown) =>
  vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );

describe("contrato mínimo por proveedor", () => {
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PROVIDER_CONTRACT_MODE;
  });

  describe("modo enforce", () => {
    beforeEach(() => {
      process.env.PROVIDER_CONTRACT_MODE = "enforce";
    });

    it.each(cases.filter((c) => !c.swallowed))(
      "$name → ProviderContractError y no se cachea",
      async ({ call, broken }) => {
        const fetchMock = respond(broken);
        vi.stubGlobal("fetch", fetchMock);
        await expect(call()).rejects.toBeInstanceOf(ProviderContractError);
        await expect(call()).rejects.toBeInstanceOf(ProviderContractError);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(cacheStore.size).toBe(0);
      }
    );

    it.each(cases.filter((c) => c.swallowed))(
      "$name → Steam nunca rompe la ficha: lanza el contrato y no se cachea",
      async ({ call, broken }) => {
        const fetchMock = respond(broken);
        vi.stubGlobal("fetch", fetchMock);
        await expect(call()).rejects.toBeInstanceOf(ProviderContractError);
        await expect(call()).rejects.toBeInstanceOf(ProviderContractError);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(cacheStore.size).toBe(0);
      }
    );
  });

  describe("modo log (por defecto)", () => {
    it.each(cases.filter((c) => !c.swallowed && c.name !== "AniList ficha sin data"))(
      "$name → no lanza ProviderContractError",
      async ({ call, broken }) => {
        vi.stubGlobal("fetch", respond(broken));
        const out = await call().catch((e) => e);
        expect(out).not.toBeInstanceOf(ProviderContractError);
      }
    );
  });
});
