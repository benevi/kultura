// ============================================================
// KULTURA — anilist.ts unit tests (E-ANIME-SOURCE)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  discoverAnime,
  searchAnime,
  getAnime,
  isAniListId,
  toAniListRef,
  fromAniListRef,
  AniListError,
} from "@/lib/api/anilist";

function graphqlResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function graphqlErrors(
  errors: { message: string; status?: number }[],
  status = 200
): Response {
  return new Response(JSON.stringify({ errors }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const EMPTY_PAGE = {
  Page: {
    pageInfo: { currentPage: 1, lastPage: 1, hasNextPage: false, total: 0 },
    media: [],
  },
};

describe("anilistFetch — retry en 5xx (mismo criterio que Jikan)", () => {
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
      .mockResolvedValueOnce(graphqlResponse(null, 504))
      .mockResolvedValueOnce(graphqlResponse(EMPTY_PAGE));

    const promise = discoverAnime(1, { sort: ["POPULARITY_DESC"] });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.media).toEqual([]);
  });

  it("504 dos veces → lanza AniListError tras un solo reintento", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(graphqlResponse(null, 504));

    const promise = discoverAnime(1, { sort: ["POPULARITY_DESC"] }).catch(
      (e) => e
    );
    await vi.runAllTimersAsync();
    const err = (await promise) as AniListError;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(err).toBeInstanceOf(AniListError);
    expect(err.status).toBe(504);
  });

  it("429 (rate-limit) → NO reintenta", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(graphqlResponse(null, 429));

    const promise = discoverAnime(1, { sort: ["POPULARITY_DESC"] }).catch(
      (e) => e
    );
    await vi.runAllTimersAsync();
    const err = (await promise) as AniListError;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err.status).toBe(429);
  });

  it("200 con errors[] (error a nivel de query) → lanza sin reintentar", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      graphqlErrors([{ message: "Not Found.", status: 404 }])
    );

    const promise = getAnime(999999).catch((e) => e);
    const err = (await promise) as AniListError;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(AniListError);
    expect(err.status).toBe(404);
    expect(err.message).toContain("Not Found");
  });

  it("POST con body { query, variables } y User-Agent identificando la app", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(graphqlResponse(EMPTY_PAGE));

    await searchAnime("bebop", 1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graphql.anilist.co");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.variables.search).toBe("bebop");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(
      /Kultura/i
    );
  });
});

describe("isAniListId / toAniListRef / fromAniListRef", () => {
  it("toAniListRef produce 'al-{id}'", () => {
    expect(toAniListRef(1535)).toBe("al-1535");
  });

  it("isAniListId reconoce la forma 'al-{entero}'", () => {
    expect(isAniListId("al-1535")).toBe(true);
    expect(isAniListId("al-0")).toBe(true);
  });

  it("isAniListId rechaza ids legacy de Jikan (entero plano)", () => {
    expect(isAniListId("1535")).toBe(false);
    expect(isAniListId("")).toBe(false);
    expect(isAniListId("al-")).toBe(false);
    expect(isAniListId("al-12x")).toBe(false);
  });

  it("fromAniListRef extrae el entero", () => {
    expect(fromAniListRef("al-1535")).toBe(1535);
  });
});
