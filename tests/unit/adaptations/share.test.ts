// ============================================================
// F-29 · Nota compartida (firma) y top 4 de la tarjeta de /u
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import {
  formatRating10,
  isValidRatingShareSignature,
  loadSharedRating,
  rating10Of,
  ratingShareSignature,
  ratingSharePath,
} from "@/app/[locale]/u/[username]/r/_lib/share";
import { profileTopFour, type TopFourClient } from "@/app/[locale]/u/[username]/r/_lib/top-four";

const UID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  process.env.SHARE_SECRET = "secreto-de-prueba";
});

describe("firma de la nota compartida", () => {
  it("vale para su usuario y su título, y para nada más", () => {
    const sig = ratingShareSignature(UID, "movie_438631")!;
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    expect(isValidRatingShareSignature(UID, "movie_438631", sig)).toBe(true);
    expect(isValidRatingShareSignature(OTHER, "movie_438631", sig)).toBe(false);
    expect(isValidRatingShareSignature(UID, "movie_550", sig)).toBe(false);
    expect(isValidRatingShareSignature(UID, "movie_438631", sig.toUpperCase())).toBe(false);
    expect(isValidRatingShareSignature(UID, "movie_438631", "")).toBe(false);
    expect(isValidRatingShareSignature(UID, "movie_438631", null)).toBe(false);
  });

  it("otra clave, otra firma; sin clave, sin enlace", () => {
    const a = ratingShareSignature(UID, "movie_1");
    process.env.SHARE_SECRET = "otra";
    expect(ratingShareSignature(UID, "movie_1")).not.toBe(a);
    delete process.env.SHARE_SECRET;
    const invite = process.env.INVITE_SECRET;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.INVITE_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(ratingShareSignature(UID, "movie_1")).toBeNull();
    expect(ratingSharePath("es", { id: UID, username: "benevi" }, "movie_1")).toBeNull();
    if (invite !== undefined) process.env.INVITE_SECRET = invite;
    if (service !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = service;
  });

  it("ruta /{locale}/u/{usuario}/r/{tipo}/{id}?s=…", () => {
    const sig = ratingShareSignature(UID, "anime_al-16498");
    expect(ratingSharePath("es", { id: UID, username: "benevi" }, "anime_al-16498")).toBe(
      `/es/u/benevi/r/anime/al-16498?s=${sig}`,
    );
    expect(ratingSharePath("es", { id: UID, username: "benevi" }, "podcast_1")).toBeNull();
  });

  it("nota: rating10, o score × 2 antes de F-24; formato del idioma", () => {
    expect(rating10Of({ rating10: 9, score: 5 })).toBe(9);
    expect(rating10Of({ rating10: "8.5", score: 4 })).toBe(8.5);
    expect(rating10Of({ score: 3 })).toBe(6);
    expect(rating10Of({ rating10: null, score: null })).toBeNull();
    expect(rating10Of(null)).toBeNull();
    expect(formatRating10(8.5, "es")).toBe("8,5");
    expect(formatRating10(8.5, "en")).toBe("8.5");
    expect(formatRating10(9, "es")).toBe("9");
  });
});

type Res = { data: unknown; error: { code?: string } | null };
function reader(handlers: { users?: Res; media?: Res[] }) {
  const media = [...(handlers.media ?? [])];
  const seen: string[] = [];
  const client = {
    from: (table: string) => ({
      select: (cols: string) => {
        seen.push(`${table}:${cols}`);
        const result = () => (table === "users" ? handlers.users! : media.shift()!);
        const chain = {
          eq: () => chain,
          maybeSingle: async () => result(),
        };
        return chain;
      },
    }),
  };
  return { client: client as never, seen };
}

describe("loadSharedRating", () => {
  const sig = () => ratingShareSignature(UID, "movie_438631");

  it("con firma válida: dueño y nota (leída con el service role)", async () => {
    const pub = reader({ users: { data: { id: UID, username: "benevi" }, error: null } });
    const admin = reader({ media: [{ data: { rating10: 9, score: 5 }, error: null }] });
    expect(await loadSharedRating("benevi", "movie_438631", sig(), { publicClient: pub.client, adminClient: admin.client })).toEqual({
      owner: { id: UID, username: "benevi" },
      rating10: 9,
    });
  });

  it("firma de otro usuario o inventada: null y la nota ni se lee", async () => {
    const pub = reader({ users: { data: { id: OTHER, username: "ana" }, error: null } });
    const admin = reader({ media: [{ data: { rating10: 9 }, error: null }] });
    expect(await loadSharedRating("ana", "movie_438631", sig(), { publicClient: pub.client, adminClient: admin.client })).toBeNull();
    expect(admin.seen).toEqual([]);
    expect(await loadSharedRating("ana", "movie_438631", "0".repeat(32), { publicClient: pub.client, adminClient: admin.client })).toBeNull();
    expect(await loadSharedRating("ana", "movie_438631", undefined, { publicClient: pub.client, adminClient: admin.client })).toBeNull();
  });

  it("sin rating10 (antes de F-24) usa score; sin nota, null", async () => {
    const pub = () => reader({ users: { data: { id: UID, username: "benevi" }, error: null } }).client;
    const admin = reader({ media: [{ data: null, error: { code: "42703" } }, { data: { score: 4 }, error: null }] });
    expect(await loadSharedRating("benevi", "movie_438631", sig(), { publicClient: pub(), adminClient: admin.client })).toMatchObject({ rating10: 8 });
    expect(admin.seen).toEqual(["user_media:rating10, score", "user_media:score"]);
    const none = reader({ media: [{ data: null, error: null }] });
    expect(await loadSharedRating("benevi", "movie_438631", sig(), { publicClient: pub(), adminClient: none.client })).toBeNull();
  });
});

function topClient(visibility: Res, media: Res[]): { client: TopFourClient; seen: string[] } {
  const queue = [...media];
  const seen: string[] = [];
  const client = {
    from: (table: string) => ({
      select: (cols: string) => {
        seen.push(`${table}:${cols}`);
        const eq = {
          maybeSingle: async () => visibility,
          in: () => ({ limit: async () => queue.shift()! }),
        };
        return { eq: () => eq };
      },
    }),
  } as unknown as TopFourClient;
  return { client, seen };
}

const item = (n: number, poster = true) => ({ mediaId: `movie_${n}`, title: `T${n}`, poster: poster ? `https://img/${n}.jpg` : null, type: "movie" });

describe("profileTopFour (tarjeta de /u)", () => {
  const items = [item(1), item(2), item(3, false), item(4), item(5), item(6), item(2)];

  it("ordena los títulos PÚBLICOS por favorito y nota; completa con el resto", async () => {
    const { client, seen } = topClient({ data: { library_visibility: "friends" }, error: null }, [
      {
        data: [
          { media_id: "movie_5", favorite: false, rating10: 10 },
          { media_id: "movie_4", favorite: true, rating10: 6 },
          { media_id: "movie_3", favorite: true, rating10: 10 },
        ],
        error: null,
      },
    ]);
    expect(await profileTopFour(UID, items, client)).toEqual({
      posters: ["https://img/4.jpg", "https://img/5.jpg", "https://img/1.jpg", "https://img/2.jpg"],
      ranked: true,
    });
    // Solo se pregunta por los ids públicos con portada, sin repetir.
    expect(seen).toContain("user_media:media_id, favorite, rating10, score");
  });

  it("biblioteca 'Solo yo': ni el orden; las cuatro primeras de sus listas", async () => {
    const { client, seen } = topClient({ data: { library_visibility: "private" }, error: null }, []);
    expect(await profileTopFour(UID, items, client)).toEqual({
      posters: ["https://img/1.jpg", "https://img/2.jpg", "https://img/4.jpg", "https://img/5.jpg"],
      ranked: false,
    });
    expect(seen.some((s) => s.startsWith("user_media"))).toBe(false);
  });

  it("sin columnas nuevas (42703) usa score; sin notas o sin cliente, sin orden", async () => {
    const old = topClient({ data: null, error: { code: "42703" } }, [
      { data: null, error: { code: "42703" } },
      { data: [{ media_id: "movie_6", score: 5 }], error: null },
    ]);
    expect((await profileTopFour(UID, items, old.client)).posters[0]).toBe("https://img/6.jpg");
    const none = topClient({ data: { library_visibility: "public" }, error: null }, [{ data: [], error: null }]);
    expect((await profileTopFour(UID, items, none.client)).ranked).toBe(false);
    expect(await profileTopFour(UID, items, null)).toMatchObject({ ranked: false });
    expect(await profileTopFour(UID, [], null)).toEqual({ posters: [], ranked: false });
  });
});
