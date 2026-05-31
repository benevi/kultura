// ============================================================
// KULTURA — comicvine.ts unit tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getComic,
  getRecentComics,
  resolveVolumePublishers,
  isMangaPublisher,
  isAdultPublisher,
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

describe("isMangaPublisher", () => {
  it("detecta editoriales de manga (case-insensitive, substring)", () => {
    expect(isMangaPublisher("Shueisha")).toBe(true);
    expect(isMangaPublisher("kodansha")).toBe(true);
    expect(isMangaPublisher("Kodansha USA Publishing")).toBe(true); // substring
    expect(isMangaPublisher("VIZ Media")).toBe(true);
    expect(isMangaPublisher("Yen Press")).toBe(true);
    expect(isMangaPublisher("Webtoon")).toBe(true); // manhwa
  });

  it("acepta cualquier editorial de cómic occidental/mundial y trata vacío como no-manga", () => {
    expect(isMangaPublisher("DC Comics")).toBe(false);
    expect(isMangaPublisher("Marvel")).toBe(false);
    expect(isMangaPublisher("Dargaud")).toBe(false); // BD europea
    expect(isMangaPublisher("Norma Editorial")).toBe(false); // ES
    expect(isMangaPublisher("2000 AD")).toBe(false); // UK
    expect(isMangaPublisher("")).toBe(false);
  });
});

describe("isAdultPublisher", () => {
  it("detecta sellos eróticos/porno (case-insensitive, substring)", () => {
    expect(isAdultPublisher("Eros Comix")).toBe(true);
    expect(isAdultPublisher("NBM Amerotica")).toBe(true);
    expect(isAdultPublisher("FAKKU")).toBe(true);
    expect(isAdultPublisher("Penthouse Comix")).toBe(true);
    expect(isAdultPublisher("class comics")).toBe(true);
  });

  it("acepta editoriales de cómic normales y trata vacío como no-adulto", () => {
    expect(isAdultPublisher("DC Comics")).toBe(false);
    expect(isAdultPublisher("Image Comics")).toBe(false);
    expect(isAdultPublisher("Dargaud")).toBe(false);
    expect(isAdultPublisher("")).toBe(false);
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

  it("descarta issues sin publisher resuelto (el manga llega así y se colaba)", async () => {
    const fetchMock = mockFetchByPath(
      {
        status_code: 1,
        error: "OK",
        number_of_total_results: 2,
        results: [
          { ...ISSUE, id: 20, volume: { id: 200, name: "Naruto" } },
          { ...ISSUE, id: 21, volume: { id: 201, name: "Saga" } },
        ],
      },
      {
        status_code: 1,
        error: "OK",
        // /volumes/ solo resuelve el cómic occidental (201); el volumen 200 queda
        // sin publisher y debe descartarse.
        results: [{ id: 201, publisher: { id: 3, name: "Image Comics" } }],
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRecentComics();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("comic_21");
  });

  it("descarta issues de sello adulto/erótico", async () => {
    const fetchMock = mockFetchByPath(
      {
        status_code: 1,
        error: "OK",
        number_of_total_results: 2,
        results: [
          { ...ISSUE, id: 30, volume: { id: 300, name: "Saga" } },
          { ...ISSUE, id: 31, volume: { id: 301, name: "Birdland" } },
        ],
      },
      {
        status_code: 1,
        error: "OK",
        results: [
          { id: 300, publisher: { id: 3, name: "Image Comics" } },
          { id: 301, publisher: { id: 4, name: "Eros Comix" } },
        ],
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRecentComics();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("comic_30");
  });

  it("descarta issues de editorial de manga", async () => {
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
