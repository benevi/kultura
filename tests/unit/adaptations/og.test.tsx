// ============================================================
// F-29 · Tarjetas OG: nota compartida y top 4 del perfil, 1200×630
// Se pinta de verdad con next/og (satori + resvg) y se lee el tamaño de la
// cabecera del PNG. Sin red: portadas y fuentes simuladas.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  loadMediaDetail: vi.fn(),
  loadSharedRating: vi.fn(),
  getPublicCollection: vi.fn(),
  profileTopFour: vi.fn(),
}));

vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetail: mocks.loadMediaDetail }));
vi.mock("@/lib/og/poster", () => ({ posterDataUri: vi.fn(async () => null) }));
vi.mock("@/lib/og/brand", async (orig) => ({
  ...(await orig<typeof import("@/lib/og/brand")>()),
  loadFont: vi.fn(async () => null),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, string>) =>
    values ? `${key}(${Object.values(values).join(",")})` : key,
}));
vi.mock("@/app/[locale]/u/[username]/r/_lib/share", async (orig) => ({
  ...(await orig<typeof import("@/app/[locale]/u/[username]/r/_lib/share")>()),
  loadSharedRating: mocks.loadSharedRating,
}));
vi.mock("@/app/[locale]/u/[username]/r/_lib/top-four", () => ({ profileTopFour: mocks.profileTopFour }));
vi.mock("@/lib/social/public-collection", () => ({
  getPublicCollection: mocks.getPublicCollection,
  resolveRenamedUsername: vi.fn(async () => null),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { GET } from "@/app/[locale]/u/[username]/r/[type]/[id]/card/route";
import ProfileImage, { size as profileSize } from "@/app/[locale]/u/[username]/opengraph-image";

async function pngSize(res: Response) {
  const buf = Buffer.from(await res.arrayBuffer());
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const ctx = (over: Record<string, string> = {}) => ({
  params: Promise.resolve({ locale: "es", username: "benevi", type: "movie", id: "438631", ...over }),
});

beforeEach(() => {
  mocks.loadMediaDetail.mockResolvedValue({ item: { id: "movie_438631", title: "Dune", poster: "https://image.tmdb.org/t/p/w500/x.jpg", type: "movie" } });
  mocks.loadSharedRating.mockResolvedValue({ owner: { id: "u1", username: "benevi" }, rating10: 9 });
});

describe("tarjeta de la nota compartida", () => {
  it("con firma: PNG 1200×630, caché de una hora", async () => {
    const res = await GET(new Request("https://k.app/es/u/benevi/r/movie/438631/card?s=abc"), ctx());
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toMatch(/max-age=3600/);
    expect(await pngSize(res)).toEqual({ width: 1200, height: 630 });
    expect(mocks.loadSharedRating).toHaveBeenCalledWith("benevi", "movie_438631", "abc");
  });

  it("sin firma válida o sin ficha: también 1200×630 (sin la nota)", async () => {
    mocks.loadSharedRating.mockResolvedValue(null);
    mocks.loadMediaDetail.mockResolvedValue(null);
    const res = await GET(new Request("https://k.app/es/u/benevi/r/movie/438631/card"), ctx());
    expect(await pngSize(res)).toEqual({ width: 1200, height: 630 });
  });

  it("id imposible: 404 sin consultar nada", async () => {
    mocks.loadSharedRating.mockClear();
    const res = await GET(new Request("https://k.app/es/u/benevi/r/movie/x/card"), ctx({ id: "../x" }));
    expect(res.status).toBe(404);
    expect(mocks.loadSharedRating).not.toHaveBeenCalled();
  });
});

describe("tarjeta de /u con el top 4", () => {
  it("PNG 1200×630 y el top 4 sale de profileTopFour con los títulos públicos", async () => {
    const items = [{ mediaId: "movie_1", title: "A", poster: "https://img/1.jpg", type: "movie" }];
    mocks.getPublicCollection.mockResolvedValue({
      owner: { id: "u1", username: "benevi" },
      lists: [{ id: "l1", name: "Pelis", mediaType: "movie", items }],
    });
    mocks.profileTopFour.mockResolvedValue({ posters: ["https://img/1.jpg"], ranked: true });
    const res = await ProfileImage({ params: { locale: "es", username: "benevi" } });
    expect(profileSize).toEqual({ width: 1200, height: 630 });
    expect(await pngSize(res as Response)).toEqual({ width: 1200, height: 630 });
    expect(mocks.profileTopFour).toHaveBeenCalledWith("u1", items, expect.anything());
  });

  it("usuario que no existe: tarjeta genérica, sin top 4", async () => {
    mocks.getPublicCollection.mockResolvedValue(null);
    mocks.profileTopFour.mockClear();
    const res = await ProfileImage({ params: Promise.resolve({ locale: "en", username: "nadie" }) });
    expect(await pngSize(res as Response)).toEqual({ width: 1200, height: 630 });
    expect(mocks.profileTopFour).not.toHaveBeenCalled();
  });
});
