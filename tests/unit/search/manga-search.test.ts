// @vitest-environment node
// ============================================================
// KULTURA — Búsqueda de manga (F-13, DAT-7)
//
// Con respuestas REALES de MangaDex (capturadas el 2026-10-22 con los
// parámetros nuevos, `fixtures/mangadex-search.json`) se comprueba lo que
// pide la aceptación:
//   - la obra va primera en ≥ 95 % de las consultas del banco;
//   - ≥ 90 % de los resultados llevan nota (`/statistics/manga`);
//   - sin doujinshi y con los coloreados detrás de la obra;
//   - obra retirada de MangaDex ("berserk") → la de AniList arriba;
//   - MangaDex caído → AniList y, si también cae, MyAnimeList.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fixtures from "./fixtures/mangadex-search.json";
import aniBerserk from "./fixtures/anilist-manga-berserk.json";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import { resetMangaSupplementFailures, searchByTypePaged } from "@/lib/api/search";
import { fetchAggregateSearch } from "@/lib/api/aggregate";
import {
  getMangaStatistics,
  mangaDisplayTitle,
  searchManga,
  MANGADEX_DOUJINSHI_TAG,
  type MangaDexManga,
} from "@/lib/api/mangadex";
import { resetProviderCircuits } from "@/lib/api/http";

type Bundle = { search: { data: MangaDexManga[]; total: number }; statistics: unknown };
const BANK = fixtures as unknown as Record<string, Bundle>;

/** Jikan (MyAnimeList) para "berserk": la obra que MangaDex retiró. */
const JIKAN_BERSERK = {
  data: [
    {
      mal_id: 2,
      title: "Berserk",
      images: { jpg: { large_image_url: "https://cdn.myanimelist.net/images/manga/1/157897l.jpg" } },
      synopsis: "Guts, a former mercenary now known as the Black Swordsman…",
      score: 9.47,
      genres: [{ name: "Action" }],
      published: { prop: { from: { year: 1989 } } },
      chapters: null,
      volumes: null,
      status: "Publishing",
      authors: [{ name: "Miura, Kentarou" }],
    },
    {
      mal_id: 113138,
      title: "Boushoku no Berserk",
      images: { jpg: { large_image_url: "https://cdn.myanimelist.net/images/manga/3/x.jpg" } },
      synopsis: null,
      score: 7.6,
      genres: [],
      published: { prop: { from: { year: 2017 } } },
      chapters: null,
      volumes: null,
      status: "Publishing",
      authors: [],
    },
  ],
  pagination: { last_visible_page: 1, has_next_page: false },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** fetch falso: MangaDex según la consulta del fixture, Jikan con su respuesta. */
function fakeProviders(opts: { mangadexDown?: boolean; anilistDown?: boolean; jikan?: unknown } = {}) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "graphql.anilist.co") {
      if (opts.anilistDown) return json({}, 503);
      const body = JSON.parse(String(init?.body ?? "{}")) as { variables?: { search?: string } };
      return json(body.variables?.search === "berserk" ? aniBerserk : { data: { Page: { media: [] } } });
    }
    if (url.hostname === "api.mangadex.org") {
      if (opts.mangadexDown) return json({ result: "error" }, 503);
      if (url.pathname === "/manga") {
        const q = url.searchParams.get("title") ?? "";
        return json(BANK[q]?.search ?? { result: "ok", data: [], total: 0, offset: 0 });
      }
      if (url.pathname === "/statistics/manga") {
        const ids = url.searchParams.getAll("manga[]");
        const q = Object.keys(BANK).find((k) => BANK[k].search.data.some((m) => ids.includes(m.id)));
        return json(q ? BANK[q].statistics : { result: "ok", statistics: {} });
      }
    }
    if (url.hostname === "api.jikan.moe") {
      return json(opts.jikan ?? { data: [], pagination: { last_visible_page: 1 } });
    }
    return json({}, 404);
  });
}

/** Lo que se espera arriba para cada consulta del banco (título u original). */
const EXPECTED_TOP1: Record<string, RegExp | ((id: string) => boolean)> = {
  "attack on titan": /^attack on titan$/i,
  naruto: /^naruto$/i,
  "death note": /^death note$/i,
  // Hay tres "Monster": el de Urasawa (1994) es el que sigue todo el mundo.
  monster: (id) => id.startsWith("d9e30523"),
  "chainsaw man": /^chainsaw man$/i,
  "one piece": /^one piece$/i,
  nana: /^nana$/i,
  akira: /^akira$/i,
  berserk: /^berserk$/i,
  "jujutsu kaisen": /^jujutsu kaisen$/i,
  "spy x family": /^spy×family$/i,
  "tokyo ghoul": /^tokyo ghoul$/i,
  "slam dunk": /^slam dunk!?$/i,
  // Dos "Fullmetal Alchemist": el original (2001), no el coloreado de fans.
  "fullmetal alchemist": (id) => id.startsWith("dd8a907a"),
  "dragon ball": /^dragon ball$/i,
  "oshi no ko": /^【oshi no ko】$/i,
  "witch hat atelier": /^witch hat atelier$/i,
  "20th century boys": /^20th century boys$/i,
  "vinland saga": /^vinland saga$/i,
  dandadan: /^dandadan$/i,
};

beforeEach(() => {
  resetProviderCircuits();
  resetMangaSupplementFailures();
  cacheStore.clear();
});

const jikanCalls = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls.filter((c) => String(c[0]).includes("api.jikan.moe")).length;
const anilistCalls = (spy: ReturnType<typeof vi.fn>) =>
  spy.mock.calls.filter((c) => String(c[0]).includes("graphql.anilist.co")).length;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchManga — parámetros (DAT-7)", () => {
  it("relevancia, sin doujinshi, solo safe/suggestive y sin filtro de idioma", async () => {
    const spy = fakeProviders();
    vi.stubGlobal("fetch", spy);
    await searchManga("naruto", 0, "es");
    const url = new URL(String(spy.mock.calls[0][0]));
    expect(url.searchParams.get("order[relevance]")).toBe("desc");
    expect(url.searchParams.getAll("excludedTags[]")).toEqual([MANGADEX_DOUJINSHI_TAG]);
    expect(url.searchParams.getAll("contentRating[]")).toEqual(["safe", "suggestive"]);
    expect(url.searchParams.getAll("availableTranslatedLanguage[]")).toEqual([]);
  });
});

describe("getMangaStatistics", () => {
  it("una sola petición para toda la página; nota bayesiana redondeada y seguidores", async () => {
    const spy = fakeProviders();
    vi.stubGlobal("fetch", spy);
    const ids = BANK["one piece"].search.data.map((m) => m.id);
    const stats = await getMangaStatistics(ids);
    expect(spy).toHaveBeenCalledTimes(1);
    const op = stats.get("a1c7c817-4e59-43b7-9365-09675a149a6f");
    expect(op?.follows).toBeGreaterThan(100_000);
    expect(op?.rating).toBeGreaterThan(9);
    const cents = (op?.rating ?? 0) * 100;
    expect(Math.abs(cents - Math.round(cents))).toBeLessThan(1e-6);
  });

  it("si falla devuelve un mapa vacío (la nota no tumba la búsqueda)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    const stats = await getMangaStatistics(["a1c7c817-4e59-43b7-9365-09675a149a6f"]);
    expect(stats.size).toBe(0);
  });

  it("ids que no son de MangaDex no se piden", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await getMangaStatistics(["2", "abc"])).size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("mangaDisplayTitle", () => {
  it("romanización con título inglés oficial → se enseña el inglés y el original queda aparte", () => {
    const tokyo = BANK["tokyo ghoul"].search.data[0];
    expect(mangaDisplayTitle(tokyo)).toEqual({ title: "TOKYO GHOUL", original: "Toukyou Ghoul" });
  });

  it("título principal ya en inglés → se queda", () => {
    const aot = BANK["attack on titan"].search.data[0];
    expect(mangaDisplayTitle(aot).title).toBe("Attack on Titan");
  });

  it("no usa los altTitles en español (traducciones de fans) para pintar", () => {
    const dn = BANK["death note"].search.data[0];
    expect(mangaDisplayTitle(dn).title).toBe("Death Note");
  });
});

describe("searchByTypePaged('manga') con respuestas reales", () => {
  it("la obra va primera en ≥ 95 % del banco (20 consultas)", async () => {
    vi.stubGlobal("fetch", fakeProviders({ jikan: JIKAN_BERSERK }));
    const misses: string[] = [];
    for (const [q, expected] of Object.entries(EXPECTED_TOP1)) {
      const res = await searchByTypePaged(q, "manga", 1, "es");
      const top = res.items[0];
      const ok =
        typeof expected === "function"
          ? expected(top?.externalId ?? "")
          : expected.test(top?.title ?? "") || expected.test(top?.originalTitle ?? "");
      if (!ok) misses.push(`${q} → ${top?.title}`);
    }
    expect(misses.length / Object.keys(EXPECTED_TOP1).length).toBeLessThanOrEqual(0.05);
    expect(misses).toEqual([]);
  });

  it("≥ 90 % de los cinco primeros de cada consulta llevan nota (antes: 0 %)", async () => {
    vi.stubGlobal("fetch", fakeProviders({ jikan: JIKAN_BERSERK }));
    let total = 0;
    let rated = 0;
    for (const q of Object.keys(EXPECTED_TOP1)) {
      const res = await searchByTypePaged(q, "manga", 1, "es");
      const top = res.items.slice(0, 5);
      total += top.length;
      rated += top.filter((i) => typeof i.rating === "number").length;
    }
    expect(total).toBeGreaterThan(60);
    expect(rated / total).toBeGreaterThanOrEqual(0.9);
  });

  it("sin votos no hay nota (no se inventa la media bayesiana por defecto)", async () => {
    vi.stubGlobal("fetch", fakeProviders());
    const res = await searchByTypePaged("nana", "manga", 1, "es");
    const kenshuui = res.items.find((i) => i.title === "Kenshuui Nanako");
    expect(kenshuui?.rating).toBeUndefined();
  });

  it("coloreados detrás de la obra, y la obra arriba aunque el proveedor la ponga abajo", async () => {
    vi.stubGlobal("fetch", fakeProviders());
    const cm = await searchByTypePaged("chainsaw man", "manga", 1, "es");
    expect(cm.items.map((i) => i.title).slice(0, 2)).toEqual([
      "Chainsaw Man",
      "Chainsaw Man (Official Colored)",
    ]);
    const spy = await searchByTypePaged("spy x family", "manga", 1, "es");
    expect(spy.items[0].title).toBe("SPY×FAMILY");
  });

  it("ningún doujinshi en los resultados", async () => {
    vi.stubGlobal("fetch", fakeProviders());
    for (const q of ["attack on titan", "naruto", "death note"]) {
      const res = await searchByTypePaged(q, "manga", 1, "es");
      expect(res.items.some((i) => /doujinshi/i.test(i.title))).toBe(false);
    }
  });

  it("obra retirada de MangaDex (berserk): se completa con AniList y va primera", async () => {
    const spy = fakeProviders({ jikan: JIKAN_BERSERK });
    vi.stubGlobal("fetch", spy);
    const res = await searchByTypePaged("berserk", "manga", 1, "es");
    expect(res.items[0]).toMatchObject({ title: "Berserk", externalId: "al-30002" });
    expect(anilistCalls(spy)).toBe(1);
    expect(jikanCalls(spy)).toBe(0);
  });

  it("type=all NO espera a MyAnimeList aunque MangaDex no tenga la obra («berserk», «dune»)", async () => {
    const spy = fakeProviders({ jikan: JIKAN_BERSERK });
    vi.stubGlobal("fetch", spy);
    await fetchAggregateSearch("berserk", 1, "es");
    await fetchAggregateSearch("dune", 1, "es");
    expect(spy.mock.calls.some((c) => String(c[0]).includes("api.mangadex.org/manga?"))).toBe(true);
    expect(jikanCalls(spy)).toBe(0);
  });

  it("un fallo del complemento se recuerda: la misma consulta no vuelve a esperarlo en 10 min", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const spy = fakeProviders({ anilistDown: true });
    vi.stubGlobal("fetch", spy);
    await searchByTypePaged("berserk", "manga", 1, "es");
    const afterFirst = anilistCalls(spy);
    expect(afterFirst).toBeGreaterThan(0);
    await searchByTypePaged("berserk", "manga", 1, "es");
    await searchByTypePaged("Berserk", "manga", 1, "es");
    expect(anilistCalls(spy)).toBe(afterFirst);
    vi.setSystemTime(Date.now() + 11 * 60_000);
    await searchByTypePaged("berserk", "manga", 1, "es");
    expect(anilistCalls(spy)).toBeGreaterThan(afterFirst);
    vi.useRealTimers();
  });

  it("con coincidencia exacta en MangaDex no se pregunta a nadie más", async () => {
    const spy = fakeProviders();
    vi.stubGlobal("fetch", spy);
    await searchByTypePaged("naruto", "manga", 1, "es");
    expect(jikanCalls(spy) + anilistCalls(spy)).toBe(0);
  });

  it("MangaDex y AniList caídos → respaldo de MyAnimeList (ids numéricos, que la ficha ya abre)", async () => {
    vi.stubGlobal("fetch", fakeProviders({ mangadexDown: true, anilistDown: true, jikan: JIKAN_BERSERK }));
    const res = await searchByTypePaged("berserk", "manga", 1, "es");
    expect(res.items.map((i) => i.externalId)).toEqual(["2", "113138"]);
    expect(res.items[0].rating).toBe(9.47);
  });

  it("MangaDex y MyAnimeList caídos → lanza (la ruta pinta su aviso de error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({}, 503))
    );
    await expect(searchByTypePaged("naruto", "manga", 1, "es")).rejects.toBeTruthy();
  });
});
