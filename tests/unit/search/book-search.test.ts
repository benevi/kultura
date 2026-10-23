// @vitest-environment node
// ============================================================
// KULTURA — Búsqueda de libros sin error cuando Open Library va lenta (F-13)
//
// En producción `rel.py` dio `book|don quijote` → `fetchErrorKind: generic`
// a los 8,2 s: la búsqueda general de Open Library (`q=`) agotó su plazo de
// 8 s y no había respaldo (Google Books responde 503 desde Vercel). Medido el
// 2026-10-23: la búsqueda por título (`title=`) del mismo Open Library tarda
// 0,1-0,9 s cuando `q=` llega a 4-8 s. Ahora, si `q=` no ha respondido en
// `BOOK_HEDGE_MS`, se lanza en paralelo `title=` y gana la primera que
// responda; si las dos fallan, Google Books.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

import { BOOK_HEDGE_MS, searchByTypePaged } from "@/lib/api/search";
import { providerCircuitState, resetProviderCircuits } from "@/lib/api/http";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const OL_DOCS = {
  numFound: 1550,
  docs: [
    { key: "/works/OL1102469W", title: "Don Quijote de la Mancha", author_name: ["Miguel de Cervantes Saavedra"], first_publish_year: 1605, cover_i: 8231856, language: ["spa"] },
    { key: "/works/OL15177785W", title: "Vida de Don Quijote y Sancho", author_name: ["Miguel de Unamuno"], first_publish_year: 1905, cover_i: 6420340, language: ["spa"] },
    { key: "/works/OL1102470W", title: "Don Quixote", author_name: ["Miguel de Cervantes Saavedra"], first_publish_year: 1605, cover_i: 12621906, language: ["eng"] },
  ],
};

const GOOGLE = {
  totalItems: 1,
  items: [{ id: "gbQuijote1", volumeInfo: { title: "Don Quijote de la Mancha", publishedDate: "2015", imageLinks: { thumbnail: "http://books.google.com/q.jpg" } } }],
};

type Mode = "ok" | "hang" | "fail";

/** Open Library con `q=` y `title=` por separado, y Google Books. */
function providers(q: Mode, title: Mode, google: Mode = "fail") {
  return vi.fn((input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const answer = (mode: Mode, body: unknown) => {
      if (mode === "ok") return Promise.resolve(json(body));
      if (mode === "fail") return Promise.resolve(json({}, 503));
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      );
    };
    if (url.hostname === "openlibrary.org") {
      return answer(url.searchParams.has("title") ? title : q, OL_DOCS);
    }
    if (url.hostname === "www.googleapis.com") return answer(google, GOOGLE);
    return Promise.resolve(json({}, 404));
  });
}

const used = (spy: ReturnType<typeof providers>, pred: (u: URL) => boolean) =>
  spy.mock.calls.map((c) => new URL(String(c[0]))).filter(pred).length;

beforeEach(() => {
  resetProviderCircuits();
  cacheStore.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("libros: respaldo cuando Open Library tarda o falla", () => {
  it("«don quijote» con `q=` colgado: responde la búsqueda por título antes de 4 s, sin error", async () => {
    vi.useFakeTimers();
    const spy = providers("hang", "ok");
    vi.stubGlobal("fetch", spy);
    let settled = false;
    const p = searchByTypePaged("don quijote", "book", 1, "es").finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(BOOK_HEDGE_MS + 500);
    expect(settled).toBe(true);
    const res = await p;
    expect(BOOK_HEDGE_MS + 500).toBeLessThan(4000);
    expect(res.items[0].title).toBe("Don Quijote de la Mancha");
    expect(used(spy, (u) => u.searchParams.has("title"))).toBe(1);
    // La petición perdedora (`q=`) se cancela, y cancelarla no es un fallo
    // del proveedor: el circuito de Open Library sigue cerrado.
    const loser = spy.mock.calls.find((c) => new URL(String(c[0])).searchParams.has("q"));
    expect((loser?.[1] as RequestInit).signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(providerCircuitState("openlibrary")).toBe("closed");
  });

  it("si `q=` gana después de lanzar el respaldo, se cancela `title=`", async () => {
    vi.useFakeTimers();
    let resolveQ: (r: Response) => void = () => {};
    const spy = vi.fn((input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.searchParams.has("title")) {
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        );
      }
      return new Promise<Response>((resolve) => {
        resolveQ = resolve;
      });
    });
    vi.stubGlobal("fetch", spy);
    const p = searchByTypePaged("don quijote", "book", 1, "es");
    await vi.advanceTimersByTimeAsync(BOOK_HEDGE_MS + 10);
    resolveQ(json(OL_DOCS));
    const res = await p;
    expect(res.items).toHaveLength(3);
    const titleCall = spy.mock.calls.find((c) => new URL(String(c[0])).searchParams.has("title"));
    expect((titleCall?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("`q=` responde rápido: no se gasta la segunda petición", async () => {
    const spy = providers("ok", "ok");
    vi.stubGlobal("fetch", spy);
    const res = await searchByTypePaged("don quijote", "book", 1, "es");
    expect(res.items).toHaveLength(3);
    expect(used(spy, (u) => u.searchParams.has("title"))).toBe(0);
  });

  it("`q=` falla al momento: se pide por título sin esperar", async () => {
    vi.useFakeTimers();
    const spy = providers("fail", "ok");
    vi.stubGlobal("fetch", spy);
    const p = searchByTypePaged("don quijote", "book", 1, "es");
    await vi.advanceTimersByTimeAsync(10);
    const res = await p;
    expect(res.items[0].title).toBe("Don Quijote de la Mancha");
  });

  it("Open Library entera caída: Google Books", async () => {
    const spy = providers("fail", "fail", "ok");
    vi.stubGlobal("fetch", spy);
    const res = await searchByTypePaged("don quijote", "book", 1, "es");
    expect(res.items.map((i) => i.externalId)).toEqual(["gbQuijote1"]);
  });

  it("todo caído: lanza (la ruta pinta su aviso), no una rejilla vacía como «sin resultados»", async () => {
    vi.stubGlobal("fetch", providers("fail", "fail", "fail"));
    await expect(searchByTypePaged("don quijote", "book", 1, "es")).rejects.toBeTruthy();
  });
});
