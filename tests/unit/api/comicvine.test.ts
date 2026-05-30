// ============================================================
// KULTURA — comicvine.ts unit tests (getComic)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getComic } from "@/lib/api/comicvine";

// Issue de detalle tal como lo devuelve ComicVine en `results` (objeto, no array).
const ISSUE = {
  id: 12345,
  name: "The Killing Joke",
  issue_number: "1",
  cover_date: "1988-03-01",
  store_date: null,
  deck: "Una historia de Batman y el Joker.",
  image: {
    medium_url: "https://comicvine.example/medium.jpg",
    small_url: "https://comicvine.example/small.jpg",
    original_url: "https://comicvine.example/original.jpg",
  },
  volume: { name: "Batman" },
};

function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("getComic", () => {
  beforeEach(() => {
    process.env.COMICVINE_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("happy path: pide /issue/4000-{id}/ y devuelve el issue", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ status_code: 1, error: "OK", results: ISSUE })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getComic("12345");

    expect(result).toEqual(ISSUE);

    // URL contiene el prefijo de tipo 4000 y el externalId.
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/issue/4000-12345/");
    expect(calledUrl).toContain("api_key=test-key");
    expect(calledUrl).toContain("format=json");

    // User-Agent identificable obligatorio para ComicVine.
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(
      "KulturaApp/1.0"
    );
  });

  it("lanza si results es null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({ status_code: 1, error: "OK", results: null })
      )
    );

    await expect(getComic("999")).rejects.toThrow(/sin results/);
  });

  it("lanza si la respuesta HTTP no es ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, false, 404))
    );

    await expect(getComic("999")).rejects.toThrow(/ComicVine 404/);
  });
});
