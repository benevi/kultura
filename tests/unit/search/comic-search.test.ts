// @vitest-environment node
// ============================================================
// KULTURA — Búsqueda de cómic por SERIE (F-13, DAT-6)
//
// Antes se buscaban ISSUES por el nombre del número, ordenados por fecha
// (VERIF-D: 0/10 consultas con la serie arriba: "sandman" → "PanelxPanel #25
// Sandman"). Ahora se buscan VOLÚMENES en `/search/` y se reordenan por
// relevancia. Las respuestas de abajo reproducen la forma real de
// `/search/?resources=volume` (con el ruido típico: series homónimas,
// reediciones extranjeras, spin-offs) y en el orden en que las devolvería un
// buscador que no prioriza la serie principal.
//
// Aceptación: serie correcta en el top-3 ≥ 80 % del banco de cómic.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import { searchByTypePaged } from "@/lib/api/search";
import {
  normalizeComicVolume,
  searchComicVolumes,
  COMIC_SEARCH_REVALIDATE_SECONDS,
  type ComicVineVolumeResult,
} from "@/lib/api/comicvine";
import { resetProviderCircuits } from "@/lib/api/http";

let nextIssue = 1000;
function vol(
  id: number,
  name: string,
  publisher: string,
  issues: number,
  start: number,
  extra: Partial<ComicVineVolumeResult> = {}
): ComicVineVolumeResult {
  return {
    id,
    name,
    start_year: String(start),
    count_of_issues: issues,
    deck: null,
    publisher: { id: id + 1, name: publisher },
    image: { medium_url: `https://comicvine.gamespot.com/a/uploads/scale_medium/${id}.jpg` },
    first_issue: { id: nextIssue++, name: null, issue_number: "1" },
    ...extra,
  };
}

/** Respuestas de `/search/?resources=volume` por consulta. */
const CV: Record<string, ComicVineVolumeResult[]> = {
  batman: [
    vol(119960, "Batman: Zatannic Panic", "DC Comics", 1, 2019),
    vol(41543, "Batman Beyond", "DC Comics", 8, 2010),
    vol(19110, "Batman", "Planeta DeAgostini", 12, 1987),
    vol(796, "Batman", "DC Comics", 713, 1940),
    vol(42721, "Batman", "DC Comics", 52, 2011),
    vol(91273, "Batman", "DC Comics", 160, 2016),
    vol(18005, "Batman: The Dark Knight Returns", "DC Comics", 4, 1986),
  ],
  sandman: [
    vol(127000, "PanelxPanel", "PanelxPanel", 60, 2017),
    vol(18068, "Sandman Mystery Theatre", "Vertigo", 70, 1993),
    vol(18086, "The Sandman", "Vertigo", 75, 1989),
    vol(2884, "The Sandman", "DC Comics", 6, 1974),
    vol(69800, "The Sandman: Overture", "Vertigo", 6, 2013),
  ],
  saga: [
    vol(20711, "Saga of the Swamp Thing", "DC Comics", 64, 1982),
    vol(52112, "Saga", "Planeta DeAgostini", 9, 2013),
    vol(48190, "Saga", "Image", 66, 2012),
    vol(5045, "Star Wars: Saga", "Dark Horse", 3, 1999),
  ],
  maus: [
    vol(37811, "Maus: A Survivor's Tale", "Pantheon Books", 2, 1986),
    vol(37812, "Maus", "Pantheon Books", 1, 1996),
    vol(93011, "MetaMaus", "Pantheon Books", 1, 2011),
  ],
  "v for vendetta": [
    vol(98000, "V for Vendetta: Panini Edition", "Panini Verlag", 3, 2006),
    vol(5428, "V for Vendetta", "DC Comics", 10, 1988),
  ],
  watchmen: [
    vol(45740, "Before Watchmen: Minutemen", "DC Comics", 6, 2012),
    vol(16823, "Watchmen", "Ediciones Zinco", 12, 1987),
    vol(3207, "Watchmen", "DC Comics", 12, 1986),
  ],
  "the walking dead": [
    vol(70005, "The Walking Dead: Here's Negan", "Image", 4, 2016),
    vol(18166, "The Walking Dead", "Image", 193, 2003),
    vol(60000, "The Walking Dead", "Cross Cult", 30, 2006),
  ],
  "spider-man": [
    vol(2127, "The Amazing Spider-Man", "Marvel", 441, 1963),
    vol(4040, "Spider-Man", "Marvel", 98, 1990),
    vol(31000, "Spider-Man 2099", "Marvel", 46, 1992),
  ],
  "x-men": [
    vol(2133, "The Uncanny X-Men", "Marvel", 544, 1963),
    vol(4250, "X-Men", "Marvel", 275, 1991),
    vol(4251, "X-Men Unlimited", "Marvel", 50, 1993),
  ],
  superman: [
    vol(18081, "Superman/Batman", "DC Comics", 87, 2003),
    vol(796001, "Superman", "DC Comics", 423, 1939),
    vol(42730, "Superman", "DC Comics", 52, 2011),
  ],
  invincible: [
    vol(43000, "Invincible Iron Man", "Marvel", 33, 2008),
    vol(17993, "Invincible", "Image", 144, 2003),
    vol(77000, "Invincible Universe", "Image", 12, 2013),
  ],
  hellboy: [
    vol(23500, "Hellboy: Weird Tales", "Dark Horse", 8, 2003),
    vol(18000, "Hellboy", "Cross Cult", 14, 2006),
    vol(4789, "Hellboy: Seed of Destruction", "Dark Horse", 4, 1994),
  ],
  tintin: [
    vol(30000, "Tintins äventyr", "Carlsen Comics", 22, 1972),
    vol(25000, "Les Aventures de Tintin", "Casterman", 24, 1930),
    vol(33000, "Tintin", "Little, Brown", 3, 2011),
  ],
  daredevil: [
    vol(2098, "Daredevil", "Marvel", 380, 1964),
    vol(32000, "Daredevil: Born Again", "Marvel", 1, 1987),
  ],
  asterix: [
    vol(31700, "Astérix", "Dargaud", 38, 1961),
    vol(31701, "Asterix", "Ehapa", 30, 1968),
  ],
};

/** Qué cuenta como "la serie correcta" para cada consulta (título y editorial). */
const EXPECTED: Record<string, (title: string, publisher: string) => boolean> = {
  batman: (t, p) => t === "Batman" && p === "DC Comics",
  sandman: (t, p) => t === "The Sandman" && p === "Vertigo",
  saga: (t, p) => t === "Saga" && p === "Image",
  maus: (t) => /^maus/i.test(t),
  "v for vendetta": (t, p) => t === "V for Vendetta" && p === "DC Comics",
  watchmen: (t, p) => t === "Watchmen" && p === "DC Comics",
  "the walking dead": (t, p) => t === "The Walking Dead" && p === "Image",
  "spider-man": (t) => /spider-man/i.test(t),
  "x-men": (t) => /x-men/i.test(t),
  superman: (t) => t === "Superman",
  invincible: (t, p) => t === "Invincible" && p === "Image",
  hellboy: (t, p) => /hellboy/i.test(t) && p === "Dark Horse",
  tintin: (t, p) => /tintin/i.test(t) && p !== "Carlsen Comics",
  daredevil: (t) => t === "Daredevil",
  asterix: (t) => /ast[eé]rix/i.test(t),
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function comicVine() {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "comicvine.gamespot.com" && url.pathname === "/api/search/") {
      const results = CV[url.searchParams.get("query") ?? ""] ?? [];
      return json({
        status_code: 1,
        error: "OK",
        number_of_total_results: results.length,
        results,
      });
    }
    return json({}, 404);
  });
}

beforeEach(() => {
  process.env.COMICVINE_KEY = "test-key";
  resetProviderCircuits();
  cacheStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchComicVolumes", () => {
  it("pide VOLÚMENES al buscador, 10 por página, y cachea 24 h por consulta (D-17)", async () => {
    const spy = comicVine();
    vi.stubGlobal("fetch", spy);
    await searchComicVolumes("sandman", 2);
    const [input, init] = spy.mock.calls[0] as unknown as [string, RequestInit & { next?: { revalidate: number } }];
    const url = new URL(input);
    expect(url.pathname).toBe("/api/search/");
    expect(url.searchParams.get("resources")).toBe("volume");
    expect(url.searchParams.get("query")).toBe("sandman");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("field_list")).toContain("first_issue");
    expect(init.next?.revalidate).toBe(COMIC_SEARCH_REVALIDATE_SECONDS);
    expect(COMIC_SEARCH_REVALIDATE_SECONDS).toBe(86_400);
  });

  it("una sola petición por búsqueda (antes: /issues/ + /volumes/)", async () => {
    const spy = comicVine();
    vi.stubGlobal("fetch", spy);
    await searchByTypePaged("batman", "comic", 1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("normalizeComicVolume", () => {
  it("la serie se abre por su PRIMER número (la ficha de cómic es por issue)", () => {
    const item = normalizeComicVolume(
      vol(18086, "The Sandman", "Vertigo", 75, 1989, { first_issue: { id: 34567, name: "Sleep of the Just", issue_number: "1" } })
    );
    expect(item).toMatchObject({
      id: "comic_34567",
      externalId: "34567",
      type: "comic",
      title: "The Sandman",
      year: 1989,
      metadata: { volumeId: 18086, issues: 75, publisher: "Vertigo", catalogPublisher: true },
    });
  });

  it("sin primer número no se puede abrir: fuera", () => {
    expect(normalizeComicVolume(vol(1, "Batman", "DC Comics", 0, 2020, { first_issue: null }))).toBeNull();
  });

  it("editoriales de adultos fuera también en la búsqueda; las que no están en la lista blanca, dentro", () => {
    expect(normalizeComicVolume(vol(2, "Algo", "Fakku", 3, 2020))).toBeNull();
    expect(normalizeComicVolume(vol(3, "Maus", "Pantheon Books", 1, 1996))?.metadata?.catalogPublisher).toBe(false);
  });
});

describe("relevancia de cómic (banco de 15 consultas)", () => {
  it("la serie correcta está en el top-3 en ≥ 80 % (y top-1 en ≥ 80 %)", async () => {
    vi.stubGlobal("fetch", comicVine());
    let top3 = 0;
    let top1 = 0;
    const misses: string[] = [];
    for (const [q, ok] of Object.entries(EXPECTED)) {
      const res = await searchByTypePaged(q, "comic", 1);
      const hits = res.items.map((i) => ok(i.title, String(i.metadata?.publisher ?? "")));
      if (hits.slice(0, 3).some(Boolean)) top3++;
      else misses.push(`${q} → ${res.items.slice(0, 3).map((i) => i.title).join(" | ")}`);
      if (hits[0]) top1++;
    }
    const n = Object.keys(EXPECTED).length;
    expect(misses).toEqual([]);
    expect(top3 / n).toBeGreaterThanOrEqual(0.8);
    expect(top1 / n).toBeGreaterThanOrEqual(0.8);
  });

  it("batman: la serie de 1940 (713 números) antes que la reedición española y el especial", async () => {
    vi.stubGlobal("fetch", comicVine());
    const res = await searchByTypePaged("batman", "comic", 1);
    expect(res.items[0].metadata).toMatchObject({ volumeId: 796 });
    expect(res.items.findIndex((i) => i.title === "Batman: Zatannic Panic")).toBeGreaterThan(2);
  });
});

describe("respaldo de cómic: Google Books (novela gráfica)", () => {
  it("ComicVine caído (o sin clave, o sin cupo) → resultados de Google Books en la categoría comics", async () => {
    const spy = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "www.googleapis.com") {
        return json({
          totalItems: 2,
          items: [
            { id: "gb-maus", volumeInfo: { title: "Maus", authors: ["Art Spiegelman"], publishedDate: "1996", categories: ["Comics & Graphic Novels"], imageLinks: { thumbnail: "http://books.google.com/x.jpg" } } },
            { id: "gb-metamaus", volumeInfo: { title: "MetaMaus", publishedDate: "2011", imageLinks: { thumbnail: "http://books.google.com/y.jpg" } } },
          ],
        });
      }
      return json({}, 404);
    });
    vi.stubGlobal("fetch", spy);
    const res = await searchByTypePaged("maus", "comic", 1);
    expect(res.items.map((i) => i.title)).toEqual(["Maus", "MetaMaus"]);
    expect(res.items[0].type).toBe("book");
    const google = spy.mock.calls.map((c) => new URL(String(c[0]))).find((u) => u.hostname === "www.googleapis.com");
    const q = google?.searchParams.get("q");
    expect(q).toBe('intitle:"maus" subject:comics');
  });

  it("ComicVine y Google Books caídos → lanza el error de ComicVine", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
    await expect(searchByTypePaged("maus", "comic", 1)).rejects.toMatchObject({ provider: "comicvine" });
  });
});
