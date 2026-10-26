// ============================================================
// F-29 · "benevi le da 9/10 a Dune" (CRE-8a): quién ve la nota
//
// La nota es biblioteca, y Ajustes promete "Sin cuenta no la ve nadie". Se
// enseña al dueño, a quien la RLS deja leer la biblioteca y a quien trae el
// enlace FIRMADO del dueño; nunca con "Solo yo" ni con bloqueo. Lo demás ve
// la página genérica, igual tenga o no nota.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWorld, worldClient, type ShareWorld } from "./share-fakes";

const h = vi.hoisted(() => ({ world: null as unknown as ShareWorld, loadMediaDetail: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => worldClient(h.world, "admin") }));
vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetail: h.loadMediaDetail }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => worldClient(h.world, "anon") }));

import {
  anonymousCanSeeLibrary,
  formatShareRating,
  isValidRatingShareSignature,
  plainRich,
  ratingSharePath,
  ratingShareSignature,
  resolveRatingShare,
  splitRich,
} from "@/app/[locale]/u/[username]/r/_lib/rating-share";

const SIG = () => ratingShareSignature("owner", "movie_438631")!;

function viewer(id: string) {
  return { id, supabase: worldClient(h.world, `user:${id}`, id) as never };
}

async function view(over: { sig?: string; viewer?: ReturnType<typeof viewer> | null; username?: string; id?: string } = {}) {
  return resolveRatingShare({
    username: over.username ?? "benevi",
    type: "movie",
    externalId: over.id ?? "438631",
    locale: "es",
    sig: over.sig,
    viewer: over.viewer ?? null,
  });
}

const libraryReadsBy = (client: string) =>
  h.world.reads.filter((r) => r.client === client && r.table === "user_media").length;

beforeEach(() => {
  h.world = createWorld();
  h.loadMediaDetail.mockReset().mockResolvedValue(null);
  // can_read_library: dueño o amistad aceptada ("friends").
  h.world.rpc.can_read_library = ({ p_owner, uid }) => ({ data: p_owner === uid || uid === "friend", error: null });
  h.world.rpc.has_block_with = () => ({ data: false, error: null });
  process.env.RATING_SCALE_10 = "1";
});
afterEach(() => {
  delete process.env.RATING_SCALE_10;
  delete process.env.SHARE_PUBLIC_LIBRARY;
  delete process.env.SHARE_SECRET;
});

describe("firma del enlace", () => {
  it("HMAC por dueño y título, 22 caracteres base64url, comparación estricta", () => {
    const sig = SIG();
    expect(sig).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(isValidRatingShareSignature("owner", "movie_438631", sig)).toBe(true);
    expect(isValidRatingShareSignature("owner", "movie_841", sig)).toBe(false);
    expect(isValidRatingShareSignature("otro", "movie_438631", sig)).toBe(false);
    expect(isValidRatingShareSignature("owner", "movie_438631", sig.slice(0, 21) + "A")).toBe(sig.endsWith("A"));
    expect(isValidRatingShareSignature("owner", "movie_438631", undefined)).toBe(false);
    expect(isValidRatingShareSignature("owner", "movie_438631", ["x"])).toBe(false);
  });

  it("rotar SHARE_SECRET invalida los enlaces ya compartidos", () => {
    const before = SIG();
    process.env.SHARE_SECRET = "otra-clave";
    expect(isValidRatingShareSignature("owner", "movie_438631", before)).toBe(false);
  });

  it("ruta firmada con `ref` del dueño (atribución, D-12)", () => {
    const path = ratingSharePath({ id: "owner", username: "benevi" }, "movie", "438631")!;
    expect(path).toBe(`/u/benevi/r/movie/438631?s=${SIG()}&ref=benevi`);
  });
});

describe("formatShareRating: la escala del dueño", () => {
  it.each([
    [{ rating10: 9, score: 5 }, "ten", "es", "9/10"],
    [{ rating10: 7.5, score: 4 }, "ten", "es", "7,5/10"],
    [{ rating10: 7.5, score: 4 }, "ten", "en", "7.5/10"],
    [{ rating10: 9, score: 5 }, "stars", "es", "4,5★"],
    [{ rating10: 8, score: 4 }, "stars", "en", "4★"],
    [{ rating10: 9, score: 5 }, "legacy", "es", "5★"],
    [{ score: 3 }, "ten", "es", "6/10"],
  ] as const)("%o en %s (%s) → %s", (entry, scale, locale, text) => {
    expect(formatShareRating(entry, scale, locale)?.text).toBe(text);
  });
  it("sin nota, nada", () => {
    expect(formatShareRating({ score: null, rating10: null }, "ten", "es")).toBeNull();
  });
});

describe("resolveRatingShare", () => {
  it("anónimo con el enlace firmado (biblioteca 'amigos'): ve la nota en SU escala", async () => {
    const v = await view({ sig: SIG() });
    expect(v).toMatchObject({ kind: "rated", signed: true, isOwner: false, rating: { text: "9/10" }, media: { title: "Dune" } });
  });

  it("anónimo sin firma: genérica y el cliente admin ni mira la biblioteca", async () => {
    const v = await view();
    expect(v.kind).toBe("generic");
    expect(libraryReadsBy("admin")).toBe(0);
  });

  it("genérica idéntica tenga o no nota (no se filtra nada por diferencia)", async () => {
    const withRating = await view();
    h.world.db.tables.user_media = [];
    const without = await view();
    expect(without).toEqual(withRating);
  });

  it("firma de OTRO título no vale", async () => {
    const v = await view({ sig: ratingShareSignature("owner", "movie_841")! });
    expect(v.kind).toBe("generic");
  });

  it("'Solo yo': ni con firma (el dueño sí la ve)", async () => {
    h.world.db.tables.users[0].library_visibility = "private";
    h.world.rpc.can_read_library = ({ p_owner, uid }) => ({ data: p_owner === uid, error: null });
    expect((await view({ sig: SIG() })).kind).toBe("generic");
    expect((await view({ sig: SIG(), viewer: viewer("friend") })).kind).toBe("generic");
    expect(await view({ viewer: viewer("owner") })).toMatchObject({ kind: "rated", isOwner: true });
  });

  it("amigo con sesión sin firma: la ve con SU sesión (RLS), no con el admin", async () => {
    const v = await view({ viewer: viewer("friend") });
    expect(v).toMatchObject({ kind: "rated", signed: false });
    expect(libraryReadsBy("user:friend")).toBe(1);
    expect(libraryReadsBy("admin")).toBe(0);
  });

  it("desconocido con sesión: sin firma genérica; con firma, nota", async () => {
    expect((await view({ viewer: viewer("stranger") })).kind).toBe("generic");
    expect((await view({ viewer: viewer("stranger"), sig: SIG() })).kind).toBe("rated");
  });

  it("bloqueo en cualquier sentido: genérica aunque traiga la firma o sea amigo", async () => {
    h.world.rpc.has_block_with = () => ({ data: true, error: null });
    expect((await view({ viewer: viewer("friend"), sig: SIG() })).kind).toBe("generic");
    expect(libraryReadsBy("admin")).toBe(0);
  });

  it("si no se puede comprobar el bloqueo (error raro), no se enseña", async () => {
    h.world.rpc.has_block_with = () => ({ data: null, error: { code: "XX000", message: "boom" } });
    expect((await view({ viewer: viewer("stranger"), sig: SIG() })).kind).toBe("generic");
  });

  it("sin cuenta y sin firma, solo con SHARE_PUBLIC_LIBRARY=1 y biblioteca pública", async () => {
    h.world.db.tables.users[0].library_visibility = "public";
    expect((await view()).kind).toBe("generic");
    process.env.SHARE_PUBLIC_LIBRARY = "1";
    expect(await view()).toMatchObject({ kind: "rated", publicWithoutSignature: true });
    expect(anonymousCanSeeLibrary("friends")).toBe(false);
  });

  it("sin RATING_SCALE_10: la nota entera de siempre", async () => {
    delete process.env.RATING_SCALE_10;
    expect(await view({ sig: SIG() })).toMatchObject({ rating: { text: "5★", scale: "legacy" } });
  });

  it("escala ½★ del dueño", async () => {
    h.world.metadata.owner = { rating_scale: "stars" };
    expect(await view({ sig: SIG() })).toMatchObject({ rating: { text: "4,5★" } });
  });

  it("usuario o título inexistentes → not_found; título fuera del catálogo → ficha del proveedor", async () => {
    expect((await view({ username: "nadie" })).kind).toBe("not_found");
    expect((await view({ id: "abc" })).kind).toBe("not_found");
    h.world.db.tables.media = [];
    h.world.db.tables.user_media = [];
    h.loadMediaDetail.mockResolvedValue({ item: { title: "Dune: Parte Dos", poster: undefined, year: 2024 } });
    expect(await view({ id: "693134" })).toMatchObject({ kind: "generic", media: { title: "Dune: Parte Dos", poster: null } });
    h.loadMediaDetail.mockResolvedValue(null);
    expect((await view({ id: "999" })).kind).toBe("not_found");
  });

  it("sin la columna de visibilidad (F-12 sin aplicar) se trata como 'amigos'", async () => {
    for (const u of h.world.db.tables.users) delete u.library_visibility;
    expect((await view()).kind).toBe("generic");
    expect((await view({ sig: SIG() })).kind).toBe("rated");
  });
});

describe("splitRich / plainRich", () => {
  it("trozos con su etiqueta y valores que NO abren etiquetas", () => {
    expect(splitRich("<who>@{username}</who> le da <score>{rating}</score> a <work>{title}</work>", {
      username: "benevi",
      rating: "9/10",
      title: "<b>Dune</b>",
    })).toEqual([
      { text: "@benevi", tag: "who" },
      { text: " le da " },
      { text: "9/10", tag: "score" },
      { text: " a " },
      { text: "<b>Dune</b>", tag: "work" },
    ]);
    expect(plainRich("@{username} en KULTURA", { username: "ana" })).toBe("@ana en KULTURA");
  });
});
