import { describe, it, expect } from "vitest";
import { parseDiscoverParams } from "@/lib/api/discover-params";
import { buildTmdbDiscoverParams } from "@/lib/api/tmdb-maps";

// E88: el filtro de valoración se mapea a vote_average.gte (TMDB) vía el slug
// canónico. La UI emite `rating`; tras el fix también se acepta el alias
// `valoracion` en la URL para que una URL escrita a mano no falle en silencio.
describe("E88 — filtro de valoración", () => {
  it("rating=9 (lo que emite la UI) → vote_average.gte=9", () => {
    const sp = new URLSearchParams("type=movie&year=2026&platform=netflix&rating=9&sort=title_az");
    const parsed = parseDiscoverParams(sp);
    expect(parsed.valoracion).toBe("9");
    const tmdb = buildTmdbDiscoverParams("movie", parsed);
    expect(tmdb["vote_average.gte"]).toBe("9");
  });

  it("valoracion=9 (alias natural en URL) → también aplica vote_average.gte=9", () => {
    const sp = new URLSearchParams("type=movie&year=2026&platform=netflix&valoracion=9&sort=title_az");
    const parsed = parseDiscoverParams(sp);
    expect(parsed.valoracion).toBe("9");
    const tmdb = buildTmdbDiscoverParams("movie", parsed);
    expect(tmdb["vote_average.gte"]).toBe("9");
  });

  it("rating tiene prioridad sobre valoracion si ambos vienen", () => {
    const sp = new URLSearchParams("type=movie&rating=8&valoracion=6");
    const parsed = parseDiscoverParams(sp);
    expect(parsed.valoracion).toBe("8");
  });

  it("sort=title_az no pisa vote_average.gte", () => {
    const sp = new URLSearchParams("type=movie&rating=8&sort=title_az");
    const parsed = parseDiscoverParams(sp);
    const tmdb = buildTmdbDiscoverParams("movie", parsed);
    expect(tmdb["vote_average.gte"]).toBe("8");
    expect(tmdb.sort_by).toContain("title");
  });

  it("sin filtro → sin vote_average.gte", () => {
    const sp = new URLSearchParams("type=movie&sort=title_az");
    const parsed = parseDiscoverParams(sp);
    const tmdb = buildTmdbDiscoverParams("movie", parsed);
    expect(tmdb["vote_average.gte"]).toBeUndefined();
  });
});
