// ============================================================
// F-29 · Tarjetas OG con next/og (CRE-8a y c)
//
//   - la de la nota se pide SIEMPRE sin sesión: `opengraph-image` genérica y
//     la firmada en `card/[sig]` (route handler: 404 con firma que no vale);
//   - regresión (revisión del PR #51): el archivo de metadatos NO tiene
//     `generateImageMetadata`, que publicaba la firma como og:image en
//     cualquier respuesta de la página (también en un 404);
//   - caché corta, no el año por defecto de ImageResponse;
//   - el top 4 del perfil solo si la biblioteca se puede ver sin cuenta.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWorld, worldClient, type ShareWorld } from "./share-fakes";

const h = vi.hoisted(() => ({
  world: null as unknown as ShareWorld,
  responses: [] as Array<{ element: unknown; options: Record<string, unknown> }>,
  posterDataUri: vi.fn(async (src: string) => `data:image/jpeg;base64,${src.length}`),
  getPublicCollection: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: () => {
    throw new Error("`getTranslations` is not supported in Client Components.");
  },
}));
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: unknown, options: Record<string, unknown>) {
      h.responses.push({ element, options });
    }
  },
}));
vi.mock("@/lib/og/brand", async (orig) => ({
  ...(await orig<typeof import("@/lib/og/brand")>()),
  loadFont: async () => null,
}));
vi.mock("@/lib/og/poster", () => ({ posterDataUri: h.posterDataUri }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => worldClient(h.world, "admin") }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => {
    throw new Error("la tarjeta no debe leer cookies");
  },
}));
vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetail: async () => null }));
vi.mock("@/lib/social/public-collection", async (orig) => ({
  ...(await orig<typeof import("@/lib/social/public-collection")>()),
  getPublicCollection: h.getPublicCollection,
  resolveRenamedUsername: async () => null,
}));

import * as ratedImageModule from "@/app/[locale]/u/[username]/r/[type]/[id]/opengraph-image";
import RatedImage from "@/app/[locale]/u/[username]/r/[type]/[id]/opengraph-image";
import { GET as signedCard } from "@/app/[locale]/u/[username]/r/[type]/[id]/card/[sig]/route";
import ProfileImage, { generateImageMetadata as profileImageMetadata } from "@/app/[locale]/u/[username]/opengraph-image";
import { ratingShareSignature } from "@/app/[locale]/u/[username]/r/_lib/rating-share";
import { publicTopFour } from "@/app/[locale]/u/[username]/r/_lib/top-four";

const SIG = () => ratingShareSignature("owner", "movie_438631")!;
const params = { locale: "es", username: "benevi", type: "movie", id: "438631" };

/** Texto plano del árbol JSX que recibió ImageResponse. */
function text(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  const el = node as { props?: { children?: unknown } };
  return text(el.props?.children);
}

beforeEach(() => {
  h.world = createWorld();
  h.responses = [];
  h.posterDataUri.mockClear();
  process.env.RATING_SCALE_10 = "1";
});
afterEach(() => {
  delete process.env.RATING_SCALE_10;
  delete process.env.SHARE_PUBLIC_LIBRARY;
});

describe("tarjeta de la nota", () => {
  const card = (sig: string, over: Partial<typeof params> = {}) =>
    signedCard(new Request("https://kulturaapp.vercel.app/x"), { params: Promise.resolve({ ...params, ...over, sig }) });

  it("regresión: el archivo de metadatos no anuncia variantes (ni la firma)", () => {
    expect("generateImageMetadata" in ratedImageModule).toBe(false);
    expect(ratedImageModule.size).toEqual({ width: 1200, height: 630 });
  });

  it("firmada: '@benevi le da 9/10 a Dune' con portada y caché corta", async () => {
    await card(SIG());
    const [res] = h.responses;
    expect(text(res.element)).toMatch(/@benevi\s+le\s+da\s+9\/10\s+a\s+Dune/);
    expect(h.posterDataUri).toHaveBeenCalledWith("https://image.tmdb.org/t/p/w500/d.jpg");
    expect(res.options).toMatchObject({ width: 1200, height: 630, headers: { "cache-control": "public, max-age=300, s-maxage=600" } });
    expect(String((res.options.headers as Record<string, string>)["cache-control"])).not.toContain("31536000");
  });

  it("firma que no vale, de otro título, usuario o título inexistentes: 404 sin pintar nada", async () => {
    for (const res of [
      await card("AAAAAAAAAAAAAAAAAAAAAA"),
      await card(ratingShareSignature("owner", "movie_841")!),
      await card(SIG(), { username: "nadie" }),
      await card(SIG(), { id: "x y" }),
    ]) {
      expect((res as Response).status).toBe(404);
    }
    expect(h.responses).toEqual([]);
  });

  it("genérica (o el dueño en 'Solo yo' con firma): nunca la nota", async () => {
    await RatedImage({ params });
    expect(text(h.responses[0].element)).not.toContain("9/10");
    expect(text(h.responses[0].element)).toContain("Dune");
    h.world.db.tables.users[0].library_visibility = "private";
    await card(SIG());
    expect(text(h.responses[1].element)).not.toContain("9/10");
  });

  it("en inglés y con la escala del dueño", async () => {
    h.world.metadata.owner = { rating_scale: "stars" };
    await card(SIG(), { locale: "en" });
    expect(text(h.responses[0].element)).toMatch(/@benevi\s+gives\s+Dune\s+4\.5★/);
  });
});

describe("top 4 del perfil (CRE-8c)", () => {
  beforeEach(() => {
    h.world.db.tables.users[0].library_visibility = "public";
    h.world.db.tables.user_media = [1, 2, 3, 4, 5].map((n) => ({
      user_id: "owner",
      media_id: `movie_${n}`,
      score: 6 - n,
      updated_at: `2026-10-0${n}`,
      media: { title: `Peli ${n}`, poster: `https://image.tmdb.org/t/p/w500/${n}.jpg`, type: "movie", year: 2000 + n },
    }));
    h.getPublicCollection.mockResolvedValue({
      owner: { id: "owner", username: "benevi" },
      lists: [{ id: "l1", name: "Lista", mediaType: "movie", items: [{ mediaId: "movie_9", title: "De lista", poster: "https://image.tmdb.org/t/p/w500/lista.jpg", type: "movie" }] }],
    });
  });

  it("apagado (SHARE_PUBLIC_LIBRARY sin poner): ni se consulta la biblioteca", async () => {
    await expect(publicTopFour("benevi")).resolves.toBeNull();
    expect(h.world.reads.filter((r) => r.table === "user_media")).toEqual([]);
    await ProfileImage({ params: { locale: "es", username: "benevi" } });
    expect(text(h.responses[0].element)).toContain("La colección de");
    expect(h.posterDataUri.mock.calls.map((c) => c[0])).toEqual(["https://image.tmdb.org/t/p/w500/lista.jpg"]);
  });

  it("con la bandera y biblioteca pública: 'El top 4 de' con sus 4 favoritos", async () => {
    process.env.SHARE_PUBLIC_LIBRARY = "1";
    // El doble no ordena por nota: ya vienen en orden.
    const top = await publicTopFour("benevi");
    expect(top?.map((t) => t.mediaId)).toEqual(["movie_1", "movie_2", "movie_3", "movie_4"]);
    await ProfileImage({ params: { locale: "es", username: "benevi" } });
    const card = h.responses[0];
    expect(text(card.element)).toContain("El top 4 de");
    expect(h.posterDataUri.mock.calls.map((c) => c[0])).toContain("https://image.tmdb.org/t/p/w500/1.jpg");
    expect(card.options).toMatchObject({ headers: { "cache-control": "public, max-age=300, s-maxage=600" } });
  });

  it("contador de listas con plural ICU en los dos idiomas", async () => {
    await ProfileImage({ params: { locale: "es", username: "benevi" } });
    expect(text(h.responses[0].element)).toContain("1 lista");
    h.getPublicCollection.mockResolvedValue({
      owner: { id: "owner", username: "benevi" },
      lists: ["a", "b", "c"].map((id) => ({ id, name: id, mediaType: "movie", items: [] })),
    });
    await ProfileImage({ params: { locale: "en", username: "benevi" } });
    expect(text(h.responses[1].element)).toContain("3 lists");
    expect(text(h.responses[1].element)).toContain("The collection of");
  });

  it("alt traducido con el nombre (generateImageMetadata, sin next-intl/server)", async () => {
    const [es] = await profileImageMetadata({ params: { locale: "es", username: "benevi" } });
    const [en] = await profileImageMetadata({ params: Promise.resolve({ locale: "en", username: "ana%20b" }) });
    expect(es).toMatchObject({ id: "card", alt: "@benevi en KULTURA" });
    expect(en.alt).toBe("@ana b on KULTURA");
  });

  it("con la bandera pero biblioteca 'amigos': nada de la biblioteca", async () => {
    process.env.SHARE_PUBLIC_LIBRARY = "1";
    h.world.db.tables.users[0].library_visibility = "friends";
    await expect(publicTopFour("benevi")).resolves.toBeNull();
  });
});
