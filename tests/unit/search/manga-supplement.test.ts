// @vitest-environment node
// ============================================================
// KULTURA — Obras que MangaDex no tiene (F-13, relevancia 2)
//
// En producción `rel.py` daba «Berserk - The Prototype» y «Vagabond (Hong Kong
// Colored Version)» arriba: MangaDex no tiene las series licenciadas y el
// complemento de MyAnimeList (Jikan) no responde a tiempo desde Vercel. Con
// respuestas REALES de MangaDex y de AniList (capturadas el 2026-10-23) y
// Jikan sin responder, la obra principal tiene que ganar al spin-off.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mangadex from "./fixtures/mangadex-search.json";
import aniBerserk from "./fixtures/anilist-manga-berserk.json";
import aniVagabond from "./fixtures/anilist-manga-vagabond.json";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import { resetMangaSupplementFailures, searchByType, searchByTypePaged } from "@/lib/api/search";
import { ANILIST_MANGA_SEARCH_TIMEOUT_MS } from "@/lib/api/anilist";
import { fetchAggregateSearch } from "@/lib/api/aggregate";
import { resetProviderCircuits } from "@/lib/api/http";
import { parseMediaId } from "@/lib/media/media-id";
import { resolveMediaItem } from "@/lib/media/resolve-item";

type Bundle = { search: { data: { id: string }[] }; statistics: unknown };
const MD = mangadex as unknown as Record<string, Bundle>;
const ANI: Record<string, unknown> = { berserk: aniBerserk, vagabond: aniVagabond };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function providers(opts: { anilistDown?: boolean; anilistHang?: boolean; mangadexDown?: boolean } = {}) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "graphql.anilist.co" && opts.anilistHang) {
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      );
    }
    if (url.hostname === "api.mangadex.org") {
      if (opts.mangadexDown) return json({}, 503);
      if (url.pathname === "/manga") {
        const q = url.searchParams.get("title") ?? "";
        return json(MD[q]?.search ?? { data: [], total: 0 });
      }
      const ids = url.searchParams.getAll("manga[]");
      const q = Object.keys(MD).find((k) => MD[k].search.data.some((m) => ids.includes(m.id)));
      return json(q ? MD[q].statistics : { statistics: {} });
    }
    if (url.hostname === "graphql.anilist.co") {
      if (opts.anilistDown) return json({}, 503);
      const body = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables: { search?: string } };
      if (/Media\(id: \$id, type: MANGA\)/.test(body.query)) {
        const all = [aniBerserk, aniVagabond].flatMap((f) => (f as { data: { Page: { media: { id: number }[] } } }).data.Page.media);
        return json({ data: { Media: all.find((m) => m.id === (body.variables as { id?: number }).id) } });
      }
      if (!/type: MANGA/.test(body.query)) return json({ data: { Page: { media: [] } } });
      return json(ANI[body.variables.search ?? ""] ?? { data: { Page: { media: [] } } });
    }
    // Jikan desde Vercel: no responde (se simula con un 504 inmediato).
    if (url.hostname === "api.jikan.moe") return json({}, 504);
    return json({}, 404);
  });
}

const calls = (spy: ReturnType<typeof providers>, host: string) =>
  spy.mock.calls.filter((c) => String(c[0]).includes(host)).length;

beforeEach(() => {
  resetProviderCircuits();
  resetMangaSupplementFailures();
  cacheStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("manga que MangaDex no tiene: complemento de AniList", () => {
  it.each([
    ["berserk", "Berserk", "al-30002", "Berserk - The Prototype"],
    ["vagabond", "Vagabond", "al-30656", "Vagabond (Hong Kong Colored Version)"],
  ])("«%s» → la obra principal (%s) arriba y por delante del spin-off", async (q, title, id, spinoff) => {
    vi.stubGlobal("fetch", providers());
    const res = await searchByTypePaged(q, "manga", 1, "es");
    expect(res.items[0]).toMatchObject({ title, externalId: id, type: "manga" });
    expect(res.items[0].rating).toBeGreaterThan(8);
    expect(res.items[0].poster).toMatch(/^https:\/\/s4\.anilist\.co\//);
    const spin = res.items.findIndex((i) => i.title === spinoff);
    expect(spin).toBeGreaterThan(0);
  });

  it("solo se añaden coincidencias exactas (no se duplican spin-offs de AniList)", async () => {
    vi.stubGlobal("fetch", providers());
    const res = await searchByTypePaged("berserk", "manga", 1, "es");
    expect(res.items.filter((i) => i.externalId.startsWith("al-")).map((i) => i.title)).toEqual(["Berserk"]);
  });

  it("con coincidencia exacta en MangaDex no se pregunta a AniList", async () => {
    const spy = providers();
    vi.stubGlobal("fetch", spy);
    await searchByTypePaged("naruto", "manga", 1, "es");
    expect(calls(spy, "graphql.anilist.co")).toBe(0);
  });

  it("type=all sigue sin complemento", async () => {
    const spy = providers();
    vi.stubGlobal("fetch", spy);
    await fetchAggregateSearch("berserk", 1, "es");
    expect(spy.mock.calls.some((c) => /type: MANGA/.test(String((c[1] as RequestInit | undefined)?.body ?? "")))).toBe(false);
  });

  it("AniList colgado: el complemento corta a los 2,5 s, sin reintento, y sale MangaDex", async () => {
    vi.useFakeTimers();
    const spy = providers({ anilistHang: true });
    vi.stubGlobal("fetch", spy);
    let settled = false;
    const p = searchByTypePaged("berserk", "manga", 1, "es").finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(ANILIST_MANGA_SEARCH_TIMEOUT_MS + 100);
    expect(settled).toBe(true);
    const res = await p;
    expect(res.items[0].title).toBe("Berserk - The Prototype");
    expect(calls(spy, "graphql.anilist.co")).toBe(1);
    expect(ANILIST_MANGA_SEARCH_TIMEOUT_MS).toBe(2500);
    vi.useRealTimers();
  });

  it("el autocompletado (`searchByType`) no llama al complemento: una tecla no puede tumbar AniList", async () => {
    const spy = providers();
    vi.stubGlobal("fetch", spy);
    for (const q of ["ber", "bers", "berserk"]) await searchByType(q, "manga", "es");
    expect(calls(spy, "graphql.anilist.co")).toBe(0);
  });

  it("AniList caído: la búsqueda sale con MangaDex, sin error", async () => {
    vi.stubGlobal("fetch", providers({ anilistDown: true }));
    const res = await searchByTypePaged("berserk", "manga", 1, "es");
    expect(res.items.length).toBeGreaterThan(3);
  });

  it("MangaDex caído: AniList como respaldo (antes Jikan, que no responde)", async () => {
    vi.stubGlobal("fetch", providers({ mangadexDown: true }));
    const res = await searchByTypePaged("vagabond", "manga", 1, "es");
    expect(res.items[0]).toMatchObject({ title: "Vagabond", externalId: "al-30656" });
  });
});

describe("los manga de AniList se pueden abrir y guardar", () => {
  it("el id `manga_al-{n}` es válido para la biblioteca", () => {
    expect(parseMediaId("manga_al-30002")).toMatchObject({ type: "manga", externalId: "al-30002" });
    expect(parseMediaId("manga_al-x")).toBeNull();
  });

  it("la ficha/biblioteca resuelve `al-30002` con AniList (no con Jikan)", async () => {
    const spy = providers();
    vi.stubGlobal("fetch", spy);
    const item = await resolveMediaItem({ id: "manga_al-30002", type: "manga", externalId: "al-30002" }, "es");
    expect(item).toMatchObject({ id: "manga_al-30002", type: "manga", title: "Berserk" });
    expect(calls(spy, "api.jikan.moe")).toBe(0);
  });
});
