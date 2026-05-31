// ============================================================
// KULTURA — comicvine.ts unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getComic,
  getRecentComics,
  resolveVolumePublishers,
  isWesternPublisher,
} from "@/lib/api/comicvine";

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
  volume: { id: 796, name: "Batman" },
};

function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

/**
 * Mock de fetch que responde según el path: /volumes/ → volumesBody,
 * cualquier otro (/issues/) → issuesBody. getRecentComics hace ambas llamadas.
 */
function mockFetchByPath(issuesBody: unknown, volumesBody: unknown) {
  return vi.fn().mockImplementation((url: string) =>
    Promise.resolve(
      mockResponse(url.includes("/volumes/") ? volumesBody : issuesBody)
    )
  );
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

describe("isWesternPublisher", () => {
  it("acepta editoriales de la lista blanca (case-insensitive, substring)", () => {
    expect(isWesternPublisher("DC Comics")).toBe(true);
    expect(isWesternPublisher("marvel")).toBe(true);
    expect(isWesternPublisher("Marvel Comics")).toBe(true); // substring
    expect(isWesternPublisher("IMAGE COMICS")).toBe(true);
  });

  it("rechaza editoriales no occidentales y vacíos", () => {
    expect(isWesternPublisher("Shueisha")).toBe(false);
    expect(isWesternPublisher("Kodansha")).toBe(false);
    expect(isWesternPublisher("")).toBe(false);
  });
});

describe("resolveVolumePublishers", () => {
  beforeEach(() => {
    process.env.COMICVINE_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("mapea volumeId→publisher y pide /volumes/ con field_list=id,publisher", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        status_code: 1,
        error: "OK",
        results: [
          { id: 400, publisher: { id: 1, name: "Dark Horse" } },
          { id: 401, publisher: { id: 2, name: "Oni Press" } },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const map = await resolveVolumePublishers([400, 401]);

    expect(map.get(400)).toBe("Dark Horse");
    expect(map.get(401)).toBe("Oni Press");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/volumes/");
    expect(calledUrl).toContain("field_list=id%2Cpublisher");
    expect(calledUrl).toContain("filter=id%3A400%7C401");
  });

  it("cachea: segunda llamada al mismo id no re-fetchea", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({
        status_code: 1,
        error: "OK",
        results: [{ id: 500, publisher: { id: 1, name: "Valiant" } }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await resolveVolumePublishers([500]);
    await resolveVolumePublishers([500]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getRecentComics", () => {
  beforeEach(() => {
    process.env.COMICVINE_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("happy path: pide /issues/ por fecha (limit=100), filtra occidental y normaliza", async () => {
    const fetchMock = mockFetchByPath(
      {
        status_code: 1,
        error: "OK",
        number_of_total_results: 716,
        results: [ISSUE],
      },
      {
        status_code: 1,
        error: "OK",
        results: [{ id: 796, publisher: { id: 10, name: "DC Comics" } }],
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRecentComics(2);

    expect(result.total).toBe(716);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "comic_12345",
      externalId: "12345",
      type: "comic",
      ratingSource: "ComicVine",
    });

    const issuesUrl = fetchMock.mock.calls.find((c) =>
      (c[0] as string).includes("/issues/")
    )![0] as string;
    expect(issuesUrl).toContain("sort=cover_date%3Adesc");
    expect(issuesUrl).toContain("limit=100");
    expect(issuesUrl).toContain("offset=100");
  });

  it("descarta issues de editorial no occidental (manga)", async () => {
    const fetchMock = mockFetchByPath(
      {
        status_code: 1,
        error: "OK",
        number_of_total_results: 5,
        results: [
          { ...ISSUE, id: 10, volume: { id: 100, name: "Batman" } },
          { ...ISSUE, id: 11, volume: { id: 101, name: "Cookie" } },
        ],
      },
      {
        status_code: 1,
        error: "OK",
        results: [
          { id: 100, publisher: { id: 1, name: "DC Comics" } },
          { id: 101, publisher: { id: 2, name: "Shueisha" } },
        ],
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRecentComics();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("comic_10");
  });

  it("limita a 20 items aunque haya más occidentales", async () => {
    const results = Array.from({ length: 25 }, (_, i) => ({
      ...ISSUE,
      id: 200 + i,
      volume: { id: 300, name: "Saga" },
    }));
    const fetchMock = mockFetchByPath(
      { status_code: 1, error: "OK", number_of_total_results: 999, results },
      {
        status_code: 1,
        error: "OK",
        results: [{ id: 300, publisher: { id: 3, name: "Image Comics" } }],
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRecentComics();

    expect(result.items).toHaveLength(20);
  });

  it("devuelve items vacíos y total 0 si results es null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({ status_code: 1, error: "OK", results: null })
      )
    );

    await expect(getRecentComics()).resolves.toEqual({ items: [], total: 0 });
  });
});
