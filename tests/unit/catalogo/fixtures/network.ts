// ============================================================
// KULTURA — Red simulada para los tests de caracterización del catálogo
//
// Sustituye `fetch` por un enrutador por host que devuelve respuestas con la
// forma REAL de cada proveedor y apunta cada petición (método, URL y cuerpo).
// Todo lo demás (`providerFetch`, contratos, builders, normalizadores,
// post-filtros) es el código de producción. Así una foto fija de "qué se
// pidió y qué salió" detecta cualquier cambio de comportamiento al mover
// código, incluida la FORMA de las consultas.
// ============================================================

import { vi } from "vitest";
import {
  ANIME_CASES,
  BOOK_CASES,
  GAME_CASES,
  MOVIE_CASES,
  TV_CASES,
} from "../../search/fixtures/provider-search";
import mangadexSearch from "../../search/fixtures/mangadex-search.json";

export interface RecordedCall {
  method: string;
  url: string;
  body?: string;
}

/** Fallos simulados por proveedor (host): status HTTP que se devuelve. */
export type FailMap = Partial<Record<"tmdb" | "anilist" | "mangadex" | "openlibrary" | "rawg" | "comicvine", number>>;

const movies = MOVIE_CASES.slice(0, 3).flatMap(([, results]) => results).slice(0, 20);
const shows = TV_CASES.slice(0, 3).flatMap(([, results]) => results).slice(0, 20);
const anime = ANIME_CASES.slice(0, 3).flatMap(([, results]) => results).slice(0, 20);
const books = BOOK_CASES.slice(0, 4).flatMap(([, docs]) => docs);
const games = GAME_CASES.slice(0, 3).flatMap(([, results]) => results).slice(0, 20);
const manga = Object.values(
  mangadexSearch as Record<string, { search: { data: unknown[] } }>
).flatMap((v) => v.search.data).slice(0, 20);

const issues = Array.from({ length: 12 }, (_, i) => ({
  id: 9000 + i,
  name: i % 3 === 0 ? null : `Issue ${i}`,
  issue_number: String(i + 1),
  cover_date: `20${10 + (i % 15)}-0${(i % 9) + 1}-01`,
  store_date: null,
  deck: i % 2 ? `Deck ${i}` : null,
  image: { original_url: `https://cv.example/${i}.jpg`, medium_url: `https://cv.example/m${i}.jpg` },
  volume: { id: 700 + (i % 4), name: `Volume ${i % 4}` },
}));
const volumes = [0, 1, 2, 3].map((v) => ({
  id: 700 + v,
  name: `Volume ${v}`,
  count_of_issues: 10 + v * 40,
  publisher: { id: v, name: ["Marvel", "DC Comics", "Image", "Self Published"][v] },
}));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Instala la red simulada. Devuelve la lista viva de peticiones. */
export function installNetwork(fail: FailMap = {}): RecordedCall[] {
  const calls: RecordedCall[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ method, url: url.toString(), ...(body ? { body } : {}) });
    const host = url.hostname;

    if (host === "api.themoviedb.org") {
      if (fail.tmdb) return json(fail.tmdb, {});
      const isTv = url.pathname.includes("/tv");
      const results = isTv ? shows : movies;
      return json(200, { page: 1, results, total_pages: 37, total_results: 740 });
    }
    if (host === "graphql.anilist.co") {
      if (fail.anilist) return json(fail.anilist, { errors: [{ message: "x", status: fail.anilist }] });
      return json(200, { data: { Page: { pageInfo: { lastPage: 12, hasNextPage: true }, media: anime } } });
    }
    if (host === "api.mangadex.org") {
      if (fail.mangadex) return json(fail.mangadex, {});
      if (url.pathname.startsWith("/statistics")) {
        return json(200, { result: "ok", statistics: {} });
      }
      return json(200, { result: "ok", data: manga, total: 345, limit: 20, offset: 0 });
    }
    if (host === "openlibrary.org") {
      if (fail.openlibrary) return json(fail.openlibrary, {});
      return json(200, { numFound: 1234, docs: books });
    }
    if (host === "api.rawg.io") {
      if (fail.rawg) return json(fail.rawg, {});
      return json(200, { count: 900360, results: games });
    }
    if (host === "comicvine.gamespot.com") {
      if (fail.comicvine) return json(fail.comicvine, {});
      if (url.pathname.includes("/volumes")) {
        return json(200, { status_code: 1, error: "OK", results: volumes, number_of_total_results: 4 });
      }
      return json(200, { status_code: 1, error: "OK", results: issues, number_of_total_results: 4321 });
    }
    return json(404, {});
  };
  vi.stubGlobal("fetch", vi.fn(impl));
  return calls;
}
