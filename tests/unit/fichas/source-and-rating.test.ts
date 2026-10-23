// ============================================================
// F-15 · Cita de la fuente (RAWG obligatoria) y nota media de KULTURA
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = { score: unknown; user_id: string; users: { library_visibility: string } };

const db = vi.hoisted(() => ({
  rows: [] as Row[],
  error: null as null | { code?: string; message: string },
  demoUsers: [] as string[],
  filters: [] as [string, unknown][],
  listUsersCalls: 0,
}));

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
// Imita a PostgREST: aplica los `eq` (también el del embebido `users.…`).
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: async () => {
          db.listUsersCalls++;
          return {
            data: {
              users: [
                ...db.demoUsers.map((id) => ({ id, app_metadata: { demo: true } })),
                { id: "normal", app_metadata: {} },
              ],
            },
            error: null,
          };
        },
      },
    },
    from: (table: string) => {
      if (table !== "user_media") throw new Error(`tabla inesperada ${table}`);
      const chain = {
        select: () => chain,
        eq: (col: string, value: unknown) => {
          db.filters.push([col, value]);
          return chain;
        },
        not: () => chain,
        limit: async () => {
          if (db.error) return { data: null, error: db.error };
          const data = db.rows.filter((r) =>
            db.filters.every(([col, value]) =>
              col === "users.library_visibility" ? r.users.library_visibility === value : true
            )
          );
          return { data, error: null };
        },
      };
      return chain;
    },
  }),
}));

import { sourceLinkFor } from "@/lib/media/source-link";
import { KULTURA_RATING_MIN_VOTES, getKulturaRating, summarizeScores } from "@/lib/media/kultura-rating";

const row = (user_id: string, score: number, library_visibility = "public"): Row => ({
  score,
  user_id,
  users: { library_visibility },
});


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
    db.rows = [];
    db.error = null;
    db.demoUsers = [];
    db.filters = [];
    db.listUsersCalls = 0;
  });

  it("el mínimo es de 5 notas", () => {
    expect(KULTURA_RATING_MIN_VOTES).toBe(5);
    expect(summarizeScores([5, 5, 5, 5])).toBeNull();
  });

  it("media con un decimal, ignorando valores fuera de 1-5", () => {
    expect(summarizeScores([5, 4, 4, 4, 4, null, 9, 0, "3"])).toEqual({ value: 4.2, count: 5 });
  });

  it("solo cuentan las bibliotecas públicas: la consulta filtra por library_visibility = 'public'", async () => {
    db.rows = ["a", "b", "c", "d", "e"].map((u) => row(u, 4));
    expect(await getKulturaRating("movie_550")).toEqual({ value: 4, count: 5 });
    expect(db.filters).toContainEqual(["users.library_visibility", "public"]);
    expect(db.filters).toContainEqual(["media_id", "movie_550"]);
  });

  // Regresión (revisión del PR #40): antes contaban todas las bibliotecas.
  it("las bibliotecas private y friends no cuentan aunque sumen notas de sobra", async () => {
    db.rows = [
      ...["a", "b", "c", "d"].map((u) => row(u, 5)),
      row("priv1", 1, "private"),
      row("priv2", 1, "private"),
      row("fr1", 1, "friends"),
      row("fr2", 1, "friends"),
    ];
    // 4 públicas: no llega al mínimo; nunca se completa con las privadas.
    expect(await getKulturaRating("movie_550")).toBeNull();
    db.filters = [];
    db.rows.push(row("e", 5));
    expect(await getKulturaRating("movie_550")).toEqual({ value: 5, count: 5 });
  });

  it("excluye las cuentas de la demo", async () => {
    db.demoUsers = ["demo", "lucia"];
    db.rows = [...["a", "b", "c", "d"].map((u) => row(u, 3)), row("demo", 5), row("lucia", 5)];
    expect(await getKulturaRating("movie_550")).toBeNull();
    db.filters = [];
    db.rows.push(row("e", 3));
    expect(await getKulturaRating("movie_550")).toEqual({ value: 3, count: 5 });
  });

  it("con pocas filas ni siquiera pregunta a Auth por la demo", async () => {
    db.rows = [row("a", 4)];
    expect(await getKulturaRating("movie_550")).toBeNull();
    expect(db.listUsersCalls).toBe(0);
  });

  it("sin la columna (migración de F-12 sin aplicar) no hay nota", async () => {
    db.error = { code: "42703", message: "column users_1.library_visibility does not exist" };
    expect(await getKulturaRating("movie_550")).toBeNull();
  });

  it("si la base falla, sin nota (nunca lanza)", async () => {
    db.error = { message: "boom" };
    expect(await getKulturaRating("movie_550")).toBeNull();
  });
});
