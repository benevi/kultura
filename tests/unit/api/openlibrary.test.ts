// ============================================================
// KULTURA — Open Library client unit tests (E84a)
// searchOpenLibrary construye URL (search.json + fields/limit/page)
// y manda header User-Agent. fetch mockeado.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchOpenLibrary } from "@/lib/api/openlibrary";

const OK_RESPONSE = {
  ok: true,
  json: async () => ({ docs: [], numFound: 0 }),
} as Response;

describe("searchOpenLibrary", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(OK_RESPONSE));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function lastCall() {
    const mock = fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = mock.mock.calls[0];
    return { url: new URL(String(url)), init };
  }

  it("pega a openlibrary.org/search.json", async () => {
    await searchOpenLibrary("dune");
    const { url } = lastCall();
    expect(url.origin + url.pathname).toBe("https://openlibrary.org/search.json");
  });

  it("incluye q, page, limit=20 y fields esperados", async () => {
    await searchOpenLibrary("dune", 3);
    const { url } = lastCall();
    expect(url.searchParams.get("q")).toBe("dune");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("limit")).toBe("20");
    const fields = url.searchParams.get("fields");
    expect(fields).toContain("cover_i");
    expect(fields).toContain("author_name");
    expect(fields).toContain("ebook_access");
  });

  it("page por defecto = 1", async () => {
    await searchOpenLibrary("dune");
    expect(lastCall().url.searchParams.get("page")).toBe("1");
  });

  it("manda header User-Agent KULTURA", async () => {
    await searchOpenLibrary("dune");
    const { init } = lastCall();
    expect(
      (init?.headers as Record<string, string>)["User-Agent"]
    ).toBe("KULTURA/1.0 (kultura app)");
  });

  it("params extra se mergean en la query", async () => {
    await searchOpenLibrary("dune", 1, { language: "spa" });
    expect(lastCall().url.searchParams.get("language")).toBe("spa");
  });

  it("devuelve { docs, numFound }", async () => {
    const res = await searchOpenLibrary("dune");
    expect(res).toEqual({ docs: [], numFound: 0 });
  });

  it("status no-ok lanza error con el path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response)
    );
    await expect(searchOpenLibrary("dune")).rejects.toThrow(/search\.json → 503/);
  });
});
