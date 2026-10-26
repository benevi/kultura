// ============================================================
// F-29 · /u/[username]/r/[type]/[id] y "Compartir mi nota" en la ficha
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  loadMediaDetail: vi.fn(),
  loadSharedRating: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  getViewer: vi.fn(),
  getMediaEntry: vi.fn(),
  mediaDetailProps: { current: null as null | Record<string, unknown> },
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) => (key: string, values?: Record<string, unknown>) =>
    `${namespace}.${key}${values ? `(${Object.values(values).join("|")})` : ""}`,
}));
vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetail: mocks.loadMediaDetail }));
vi.mock("@/app/[locale]/u/[username]/r/_lib/share", async (orig) => ({
  ...(await orig<typeof import("@/app/[locale]/u/[username]/r/_lib/share")>()),
  loadSharedRating: mocks.loadSharedRating,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => <header /> }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer /> }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: { src: string }) => <img src={props.src} />,
}));
// Ficha
vi.mock("@/lib/media/viewer", () => ({ getViewer: mocks.getViewer }));
vi.mock("@/lib/library/queries", () => ({ getMediaEntry: mocks.getMediaEntry }));
vi.mock("@/lib/media/kultura-rating", () => ({ getKulturaRating: vi.fn(async () => null) }));
vi.mock("@/lib/recommendations/match-score", () => ({ computeMatchScores: vi.fn(async () => new Map()) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/translate/synopsis", () => ({ translateSynopsis: vi.fn(async ({ text }: { text: string }) => text) }));
vi.mock("@/components/media/MediaDetail", () => ({
  MediaDetail: (props: Record<string, unknown>) => {
    mocks.mediaDetailProps.current = props;
    return <main />;
  },
}));

import SharedRatingPage, { generateMetadata } from "@/app/[locale]/u/[username]/r/[type]/[id]/page";
import MediaDetailPage from "@/app/[locale]/media/[type]/[id]/page";
import { ratingShareSignature } from "@/app/[locale]/u/[username]/r/_lib/share";

const props = (sp: Record<string, string> = { s: "a".repeat(32) }, over: Record<string, string> = {}) => ({
  params: Promise.resolve({ locale: "es", username: "benevi", type: "movie", id: "438631", ...over }),
  searchParams: Promise.resolve(sp),
});

const DETAIL = {
  item: { id: "movie_438631", externalId: "438631", type: "movie", title: "Dune", year: 2021, poster: "https://image.tmdb.org/t/p/w500/x.jpg" },
  genreLabels: [],
  providers: [],
  steam: null,
  source: { name: "TMDB", url: "https://www.themoviedb.org/movie/438631" },
  nsfw: false,
};

beforeEach(() => {
  process.env.SHARE_SECRET = "secreto-de-prueba";
  mocks.loadMediaDetail.mockResolvedValue(DETAIL);
  mocks.loadSharedRating.mockResolvedValue({ owner: { id: "u1", username: "benevi" }, rating10: 8.5 });
});

describe("página de la nota compartida", () => {
  it("metadatos: titular, fuera del índice y tarjeta 1200×630 con la firma", async () => {
    const meta = await generateMetadata(props());
    expect(meta.title).toBe("share.headline(benevi|8,5|Dune)");
    expect(meta.robots).toEqual({ index: false, follow: true });
    const images = meta.openGraph?.images as Array<{ url: string; width: number; height: number }>;
    expect(images[0]).toMatchObject({ width: 1200, height: 630 });
    expect(images[0].url).toMatch(/\/es\/u\/benevi\/r\/movie\/438631\/card\?s=a{32}$/);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("pinta la nota y enlaza a la ficha y al perfil", async () => {
    render(await SharedRatingPage(props()));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("share.headline(benevi|8,5|Dune)");
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/media/movie/438631");
    expect(hrefs).toContain("/u/benevi");
  });

  it("sin firma válida: a la ficha (nada de la persona) y metadatos sin tarjeta", async () => {
    mocks.loadSharedRating.mockResolvedValue(null);
    await expect(SharedRatingPage(props({}))).rejects.toThrow("REDIRECT:/es/media/movie/438631");
    const meta = await generateMetadata(props({}));
    expect(meta.openGraph).toBeUndefined();
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("id imposible o título inexistente: 404", async () => {
    await expect(SharedRatingPage(props(undefined, { id: "abc" }))).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.loadMediaDetail.mockResolvedValue(null);
    await expect(SharedRatingPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("ficha: 'Compartir mi nota' y adaptaciones", () => {
  const fichaProps = { params: Promise.resolve({ locale: "es", type: "movie", id: "438631" }) };

  it("con sesión y nota: ruta firmada para el dueño; adaptaciones con su usuario", async () => {
    mocks.getViewer.mockResolvedValue({ user: { id: "u1" }, profile: { username: "benevi" } });
    mocks.getMediaEntry.mockResolvedValue({ score: 4, rating10: 8 });
    render(await MediaDetailPage(fichaProps));
    const p = mocks.mediaDetailProps.current!;
    const sig = ratingShareSignature("u1", "movie_438631");
    expect((p.shareRating as { path: string }).path).toBe(`/es/u/benevi/r/movie/438631?s=${sig}`);
    expect(p.adaptations).toEqual({ rawgSlug: undefined, userId: "u1" });
  });

  it("sin nota o sin sesión: sin botón de compartir", async () => {
    mocks.getViewer.mockResolvedValue({ user: { id: "u1" }, profile: { username: "benevi" } });
    mocks.getMediaEntry.mockResolvedValue({ score: null, rating10: null });
    render(await MediaDetailPage(fichaProps));
    expect(mocks.mediaDetailProps.current!.shareRating).toBeUndefined();
    mocks.getViewer.mockResolvedValue({ user: null, profile: null });
    render(await MediaDetailPage(fichaProps));
    expect(mocks.mediaDetailProps.current!.shareRating).toBeUndefined();
    expect(mocks.mediaDetailProps.current!.adaptations).toEqual({ rawgSlug: undefined, userId: null });
  });

  it("juego: el slug de RAWG sale del enlace a la fuente", async () => {
    mocks.getViewer.mockResolvedValue({ user: null, profile: null });
    mocks.loadMediaDetail.mockResolvedValue({
      ...DETAIL,
      item: { ...DETAIL.item, id: "game_3328", externalId: "3328", type: "game" },
      source: { name: "RAWG", url: "https://rawg.io/games/the-witcher-3-wild-hunt" },
    });
    render(await MediaDetailPage({ params: Promise.resolve({ locale: "es", type: "game", id: "3328" }) }));
    expect(mocks.mediaDetailProps.current!.adaptations).toEqual({ rawgSlug: "the-witcher-3-wild-hunt", userId: null });
  });
});
