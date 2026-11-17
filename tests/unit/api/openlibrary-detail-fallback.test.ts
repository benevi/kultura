// ============================================================
// KULTURA — Ficha de libro sin el buscador de Open Library
// Si `search.json` no responde, `getBookDetail` monta la ficha con
// `/works/{id}.json`, su primera edición y los autores (17-11-2026).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBookDetail } from "@/lib/api/openlibrary";
import { resetProviderCircuits } from "@/lib/api/http";

type Route = (url: URL) => { status: number; body?: unknown } | "network";

function stubFetch(route: Route) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const r = route(new URL(String(input)));
    if (r === "network") throw new TypeError("fetch failed");
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: new Headers(),
      json: async () => r.body,
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const WORK = {
  title: "Una obra",
  description: { value: "Sinopsis de la obra." },
  authors: [{ author: { key: "/authors/OL1A" } }, { author: { key: "/authors/OL2A" } }],
  subjects: ["Fiction"],
  first_publish_date: "Feb 3, 2026",
};

const EDITIONS = {
  entries: [
    {
      covers: [123],
      isbn_13: ["9780000000001"],
      publishers: ["Editorial"],
      languages: [{ key: "/languages/spa" }],
    },
  ],
};

function providers(search: "ok" | "empty" | "down", extra: Partial<Record<string, "down">> = {}): Route {
  return (url) => {
    const p = url.pathname;
    if (p === "/search.json") {
      if (search === "down") return { status: 503 };
      return {
        status: 200,
        body: search === "empty" ? { docs: [], numFound: 0 } : { docs: [{ key: "/works/OL9W", title: "Del buscador" }], numFound: 1 },
      };
    }
    if (p === "/works/OL9W.json") return extra.work ? { status: 503 } : { status: 200, body: WORK };
    if (p === "/works/OL9W/editions.json") return extra.editions ? "network" : { status: 200, body: EDITIONS };
    if (p === "/authors/OL1A.json") return { status: 200, body: { name: "Autora Uno" } };
    if (p === "/authors/OL2A.json") return extra.author2 ? { status: 503 } : { status: 200, body: { name: "Autor Dos" } };
    return { status: 404 };
  };
}

describe("getBookDetail — respaldo con /works", () => {
  beforeEach(() => resetProviderCircuits());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetProviderCircuits();
  });

  it("con el buscador vivo usa su doc y la sinopsis de la obra", async () => {
    const fetchMock = stubFetch(providers("ok"));
    const res = await getBookDetail("OL9W");
    expect(res).toEqual({
      doc: { key: "/works/OL9W", title: "Del buscador" },
      description: "Sinopsis de la obra.",
    });
    const paths = fetchMock.mock.calls.map(([u]) => new URL(String(u)).pathname);
    expect(paths).not.toContain("/works/OL9W/editions.json");
  });

  it("si el buscador responde sin docs, null (no hay ficha)", async () => {
    stubFetch(providers("empty"));
    expect(await getBookDetail("OL9W")).toBeNull();
  });

  it("si el buscador cae, monta la ficha con la obra, la edición y los autores", async () => {
    stubFetch(providers("down"));
    const res = await getBookDetail("/works/OL9W");
    expect(res).toEqual({
      doc: {
        key: "/works/OL9W",
        title: "Una obra",
        author_name: ["Autora Uno", "Autor Dos"],
        first_publish_year: 2026,
        cover_i: 123,
        language: ["spa"],
        publisher: ["Editorial"],
        subject: ["Fiction"],
        isbn: ["9780000000001"],
      },
      description: "Sinopsis de la obra.",
    });
  });

  it("edición y autores son best-effort", async () => {
    stubFetch(providers("down", { editions: "down", author2: "down" }));
    const res = await getBookDetail("OL9W");
    expect(res?.doc).toEqual({
      key: "/works/OL9W",
      title: "Una obra",
      author_name: ["Autora Uno"],
      first_publish_year: 2026,
      subject: ["Fiction"],
    });
  });

  it("si caen el buscador y la obra, lanza el error del buscador", async () => {
    stubFetch(providers("down", { work: "down" }));
    await expect(getBookDetail("OL9W")).rejects.toThrow(/search\.json/);
  });
});
