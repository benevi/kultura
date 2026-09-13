// ============================================================
// KULTURA — jikan.ts unit tests
// Retry en 5xx (E-JIKAN-UA): confirmado por logs reales de Vercel que Jikan
// devuelve 504 de forma intermitente. Un solo reintento corto evita que un
// timeout puntual del servidor de Jikan tumbe toda la pantalla.
//
// E-ANIME-SOURCE: anime se sirve con AniList — Jikan queda solo para
// resolver ids legacy (getAnime/getAnimeVideos/getManga), de ahí que estos
// tests de `jikanFetch` (retry compartido por todo el módulo) usen
// `getAnime` como vehículo en vez de un endpoint de Descubrir/búsqueda.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAnime, JikanError } from "@/lib/api/jikan";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("jikanFetch — retry en 5xx", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("504 seguido de 200 → reintenta una vez y devuelve el resultado", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(null, 504))
      .mockResolvedValueOnce(jsonResponse({ data: { mal_id: 1 } }));

    const promise = getAnime(1);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ mal_id: 1 });
  });

  it("504 dos veces → lanza JikanError(504) tras un solo reintento (no más)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(null, 504));

    const promise = getAnime(1).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = (await promise) as JikanError;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(JikanError);
    expect(err.status).toBe(504);
  });

  it("429 (rate-limit) → NO reintenta (evita empeorar el límite de tasa)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(null, 429));

    const promise = getAnime(1).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = (await promise) as JikanError;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(JikanError);
    expect(err.status).toBe(429);
  });

  it("404 → NO reintenta", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(null, 404));

    const promise = getAnime(1).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = (await promise) as JikanError;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err.status).toBe(404);
  });

  it("200 a la primera → no reintenta", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({ data: { mal_id: 1 } }));

    await getAnime(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("incluye el header User-Agent identificando la app", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({ data: { mal_id: 1 } }));

    await getAnime(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(
      /Kultura/i
    );
  });
});
