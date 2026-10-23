// ============================================================
// F-15 · Cita de la fuente (RAWG obligatoria) y nota media de KULTURA
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

const { rows, adminError } = vi.hoisted(() => ({
  rows: { current: [] as { score: unknown }[] },
  adminError: { current: null as null | { message: string } },
}));

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "user_media") throw new Error(`tabla inesperada ${table}`);
      const chain = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        limit: async () => ({ data: adminError.current ? null : rows.current, error: adminError.current }),
      };
      return chain;
    },
  }),
}));

import { sourceLinkFor } from "@/lib/media/source-link";
import { KULTURA_RATING_MIN_VOTES, getKulturaRating, summarizeScores } from "@/lib/media/kultura-rating";

describe("sourceLinkFor", () => {
  it.each([
    ["movie", "550", {}, "TMDB", "https://www.themoviedb.org/movie/550"],
    ["tv", "1399", {}, "TMDB", "https://www.themoviedb.org/tv/1399"],
    ["anime", "al-1535", {}, "AniList", "https://anilist.co/anime/1535"],
    ["anime", "tmdb-37854", {}, "TMDB", "https://www.themoviedb.org/tv/37854"],
    ["anime", "1535", {}, "MyAnimeList", "https://myanimelist.net/anime/1535"],
    [
      "manga",
      "A77742B1-BEFD-49A4-BFF5-1AD4E6B0EF7B",
      {},
      "MangaDex",
      "https://mangadex.org/title/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b",
    ],
    ["manga", "al-30013", {}, "AniList", "https://anilist.co/manga/30013"],
    ["book", "OL7353617W", {}, "Open Library", "https://openlibrary.org/works/OL7353617W"],
    ["book", "OL7353617M", {}, "Open Library", "https://openlibrary.org/books/OL7353617M"],
    ["book", "zyTCAlFPjgYC", {}, "Google Books", "https://books.google.com/books?id=zyTCAlFPjgYC"],
    ["game", "3498", { rawgSlug: "grand-theft-auto-v" }, "RAWG", "https://rawg.io/games/grand-theft-auto-v"],
    ["game", "3498", {}, "RAWG", "https://rawg.io/games/3498"],
    ["comic", "6686", {}, "Comic Vine", "https://comicvine.gamespot.com/issue/4000-6686/"],
  ] as const)("%s %s → %s", (type, id, extra, name, url) => {
    expect(sourceLinkFor(type, id, extra)).toEqual({ name, url });
  });

  it("un slug de RAWG raro no entra en la URL (se usa el id)", () => {
    expect(sourceLinkFor("game", "3498", { rawgSlug: "../../evil" })?.url).toBe("https://rawg.io/games/3498");
  });

  it("un id con forma imposible no da enlace", () => {
    expect(sourceLinkFor("movie", "abc")).toBeNull();
    expect(sourceLinkFor("comic", "1/../x")).toBeNull();
  });
});

describe("nota media de KULTURA", () => {
  beforeEach(() => {
    rows.current = [];
    adminError.current = null;
  });

  it("por debajo del mínimo de notas no se publica (no es la nota de una persona)", () => {
    expect(summarizeScores(Array(KULTURA_RATING_MIN_VOTES - 1).fill(5))).toBeNull();
  });

  it("media con un decimal, ignorando valores fuera de 1-5", () => {
    expect(summarizeScores([5, 4, 4, null, 9, 0, "3"])).toEqual({ value: 4.3, count: 3 });
  });

  it("lee las notas de user_media y devuelve solo el agregado", async () => {
    rows.current = [{ score: 5 }, { score: 4 }, { score: 3 }, { score: 4 }];
    expect(await getKulturaRating("movie_550")).toEqual({ value: 4, count: 4 });
  });

  it("si la base falla, sin nota (nunca lanza)", async () => {
    adminError.current = { message: "boom" };
    expect(await getKulturaRating("movie_550")).toBeNull();
  });
});
