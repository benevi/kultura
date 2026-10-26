// ============================================================
// F-29 · Tarjetas de "También existe como…" (PRO-11)
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeDb, fakeClient, type FakeDb } from "../media/fake-supabase";
import type { AdaptationLink } from "@/lib/adaptations/map";

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  loadMediaDetail: vi.fn(),
  quotaHot: vi.fn(() => false),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient(h.db, "admin") }));
vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetail: h.loadMediaDetail }));
vi.mock("@/lib/api/http", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/http")>()),
  isProviderQuotaHot: h.quotaHot,
}));

import { DISPLAY_LIMIT, FRANCHISE_ADD_LIMIT, buildAdaptationView } from "@/lib/adaptations/display";

function link(mediaId: string, over: Partial<AdaptationLink> = {}): AdaptationLink {
  const [type, externalId] = [mediaId.split("_")[0], mediaId.slice(mediaId.indexOf("_") + 1)];
  return {
    mediaId,
    type: type as AdaptationLink["type"],
    externalId,
    qid: `Q${mediaId.length}`,
    labels: { es: `ES ${externalId}`, en: `EN ${externalId}` },
    relations: ["franchise"],
    ...over,
  };
}

beforeEach(() => {
  h.db = createFakeDb();
  h.loadMediaDetail.mockReset().mockResolvedValue(null);
  h.quotaHot.mockReset().mockReturnValue(false);
});

describe("buildAdaptationView", () => {
  it("título en el idioma, portada del catálogo y, si falta, de la ficha del proveedor", async () => {
    h.db.tables.media = [{ id: "book_OL1W", title: "Dune (catálogo)", poster: "https://covers.openlibrary.org/b/id/1-L.jpg", year: 1965 }];
    h.loadMediaDetail.mockImplementation(async (type: string, id: string) =>
      type === "movie" ? { item: { title: "Dune (TMDB)", poster: "https://image.tmdb.org/t/p/w500/x.jpg", year: 1984 } } : null
    );
    const view = await buildAdaptationView(
      [link("book_OL1W", { relations: ["source"], labels: { es: "Dune" } }), link("movie_841", { year: undefined })],
      { locale: "es", userId: null, supabase: null }
    );
    expect(view.cards).toEqual([
      expect.objectContaining({ mediaId: "book_OL1W", title: "Dune", poster: "https://covers.openlibrary.org/b/id/1-L.jpg", year: 1965, relation: "source", inLibrary: false }),
      expect.objectContaining({ mediaId: "movie_841", title: "ES 841", poster: "https://image.tmdb.org/t/p/w500/x.jpg", year: 1984 }),
    ]);
    // Solo se pide al proveedor lo que no tenía portada en el catálogo.
    expect(h.loadMediaDetail).toHaveBeenCalledTimes(1);
    expect(h.loadMediaDetail).toHaveBeenCalledWith("movie", "841", "es");
  });

  it("una ficha del proveedor lenta no retrasa la sección (tope de tiempo)", async () => {
    vi.useFakeTimers();
    h.loadMediaDetail.mockImplementation(() => new Promise(() => {}));
    const pending = buildAdaptationView([link("movie_1")], { locale: "es", userId: null, supabase: null });
    await vi.advanceTimersByTimeAsync(2600);
    const view = await pending;
    vi.useRealTimers();
    expect(view.cards[0]).toMatchObject({ mediaId: "movie_1", poster: undefined });
  });

  it("con el cupo de RAWG caliente no se pide la portada de un juego", async () => {
    h.quotaHot.mockReturnValue(true);
    await buildAdaptationView([link("game_3328")], { locale: "es", userId: null, supabase: null });
    expect(h.loadMediaDetail).not.toHaveBeenCalled();
  });

  it("con sesión: marca lo que ya está en la biblioteca y no lo ofrece para añadir", async () => {
    h.db.tables.user_media = [
      { user_id: "u1", media_id: "movie_841" },
      { user_id: "otro", media_id: "book_OL1W" },
    ];
    const supabase = fakeClient(h.db, "user") as never;
    const view = await buildAdaptationView([link("book_OL1W"), link("movie_841")], { locale: "en", userId: "u1", supabase });
    expect(view.cards.map((c) => [c.mediaId, c.inLibrary, c.title])).toEqual([
      ["book_OL1W", false, "EN OL1W"],
      ["movie_841", true, "EN 841"],
    ]);
    expect(view.addable).toEqual([{ mediaId: "book_OL1W", title: "EN OL1W" }]);
  });

  it(`enseña ${DISPLAY_LIMIT} y añade como mucho ${FRANCHISE_ADD_LIMIT}; sin id no entra`, async () => {
    const many = Array.from({ length: 30 }, (_, i) => link(`movie_${i + 1}`));
    const view = await buildAdaptationView([...many, { ...link("game_x"), mediaId: null, externalId: "" }], {
      locale: "es",
      userId: "u1",
      supabase: fakeClient(h.db, "user") as never,
    });
    expect(view.cards).toHaveLength(DISPLAY_LIMIT);
    expect(view.addable).toHaveLength(FRANCHISE_ADD_LIMIT);
    expect(FRANCHISE_ADD_LIMIT).toBeLessThan(30); // límite de /api/library: 30/min
  });

  it("sin vínculos abribles, vacío", async () => {
    await expect(buildAdaptationView([], { locale: "es", userId: null, supabase: null })).resolves.toEqual({ cards: [], addable: [] });
  });
});
