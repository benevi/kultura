// ============================================================
// F-15 · Página y layout de la ficha pública (D-01, SEO-1, SEO-2)
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaDetailData } from "@/lib/media/detail-data";

const mocks = vi.hoisted(() => ({
  loadMediaDetail: vi.fn(),
  getViewer: vi.fn(),
  getKulturaRating: vi.fn(),
  getMediaEntry: vi.fn(),
  computeMatchScores: vi.fn(),
  getUnreadCount: vi.fn(),
  mediaDetailProps: { current: null as null | Record<string, unknown> },
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (opts: { namespace?: string } | string) => {
    const ns = typeof opts === "string" ? opts : opts?.namespace;
    const map: Record<string, Record<string, string>> = {
      media: { movie: "Película", movies: "Películas", book: "Libro", game: "Videojuego", games: "Videojuegos" },
      media_detail: { notFound: "Título no encontrado", breadcrumbHome: "Inicio" },
    };
    return (key: string, values?: Record<string, string>) =>
      map[ns ?? ""]?.[key] ?? (values ? `${key}:${JSON.stringify(values)}` : key);
  },
}));
vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetail: mocks.loadMediaDetail }));
vi.mock("@/lib/media/viewer", () => ({ getViewer: mocks.getViewer }));
vi.mock("@/lib/media/kultura-rating", () => ({ getKulturaRating: mocks.getKulturaRating }));
vi.mock("@/lib/library/queries", () => ({ getMediaEntry: mocks.getMediaEntry }));
vi.mock("@/lib/recommendations/match-score", () => ({ computeMatchScores: mocks.computeMatchScores }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/social/notifications", () => ({ getUnreadCount: mocks.getUnreadCount }));
vi.mock("@/lib/translate/synopsis", () => ({
  translateSynopsis: vi.fn(async ({ text }: { text: string }) => text),
}));
// F-29: la sección de adaptaciones tiene sus propios tests (tests/unit/adaptations).
vi.mock("@/components/media/AdaptationsSection", () => ({
  AdaptationsSection: () => <section data-testid="adaptations" />,
}));
vi.mock("@/components/media/MediaDetail", () => ({
  MediaDetail: (props: Record<string, unknown>) => {
    mocks.mediaDetailProps.current = props;
    return <main data-testid="media-detail" />;
  },
}));
vi.mock("@/components/layout/AppChrome", () => ({
  getChromeSession: mocks.getViewer,
  AppChrome: ({ children, unreadCount }: { children: React.ReactNode; unreadCount: number }) => (
    <div data-testid="app-chrome" data-unread={unreadCount}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/ui/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="toasts">{children}</div>,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => <header data-testid="public-header" /> }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer data-testid="public-footer" /> }));
vi.mock("@/i18n/ClientMessages", () => ({
  ClientMessages: ({ children, namespaces }: { children: React.ReactNode; namespaces: string[] }) => (
    <div data-testid="client-messages" data-ns={namespaces.join(",")}>
      {children}
    </div>
  ),
}));

import MediaDetailPage, { generateMetadata } from "@/app/[locale]/media/[type]/[id]/page";
import MediaLayout from "@/app/[locale]/media/layout";

const BASE = "https://kulturaapp.vercel.app";

function detail(over: Partial<MediaDetailData["item"]> = {}, rest: Partial<MediaDetailData> = {}): MediaDetailData {
  return {
    item: {
      id: "movie_550",
      externalId: "550",
      type: "movie",
      title: "El club de la lucha",
      poster: "https://image.tmdb.org/t/p/w500/p.jpg",
      backdrop: "https://image.tmdb.org/t/p/w1280/b.jpg",
      year: 1999,
      synopsis: "Un oficinista insomne y un vendedor de jabón fundan un club clandestino.",
      genres: ["Thriller"],
      rating: 8.4,
      ratingSource: "TMDB",
      ...over,
    },
    genreLabels: ["Suspense"],
    trailerKey: "yt",
    providers: [{ name: "Netflix", logoPath: "x", type: "flatrate" }],
    watchLink: "https://www.themoviedb.org/movie/550/watch?locale=ES",
    steam: null,
    source: { name: "TMDB", url: "https://www.themoviedb.org/movie/550" },
    nsfw: false,
    ...rest,
  };
}

const params = (type = "movie", id = "550", locale = "es") => ({ params: Promise.resolve({ locale, type, id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mediaDetailProps.current = null;
  mocks.getViewer.mockResolvedValue({ user: null, profile: null });
  mocks.getKulturaRating.mockResolvedValue(null);
  mocks.computeMatchScores.mockResolvedValue(new Map());
  mocks.getMediaEntry.mockResolvedValue(null);
  mocks.getUnreadCount.mockResolvedValue(3);
  mocks.loadMediaDetail.mockResolvedValue(detail());
});

describe("generateMetadata de la ficha", () => {
  it("título con año y formato, descripción de la sinopsis", async () => {
    const meta = await generateMetadata(params());
    expect(meta.title).toBe("El club de la lucha (1999) · Película");
    expect(meta.description).toBe("Un oficinista insomne y un vendedor de jabón fundan un club clandestino.");
  });

  it("canonical absoluto y hreflang es/en/x-default", async () => {
    const meta = await generateMetadata(params("movie", "550", "en"));
    expect(meta.alternates?.canonical).toBe(`${BASE}/en/media/movie/550`);
    expect(meta.alternates?.languages).toEqual({
      es: `${BASE}/es/media/movie/550`,
      en: `${BASE}/en/media/movie/550`,
      "x-default": `${BASE}/es/media/movie/550`,
    });
  });

  it("sin fondo apaisado: la portada como imagen y tarjeta pequeña en X", async () => {
    mocks.loadMediaDetail.mockResolvedValue(detail({ backdrop: undefined }));
    const meta = await generateMetadata(params());
    expect(meta.openGraph).toMatchObject({
      images: [{ url: "https://image.tmdb.org/t/p/w500/p.jpg", width: 500, height: 750 }],
    });
    expect(meta.twitter).toMatchObject({ card: "summary" });
  });

  it("se indexa con portada y sinopsis", async () => {
    expect((await generateMetadata(params())).robots).toBeUndefined();
  });

  it.each([
    ["adulto", detail({}, { nsfw: true })],
    ["sin portada", detail({ poster: undefined })],
    ["sin sinopsis", detail({ synopsis: undefined })],
  ])("%s → noindex, follow", async (_label, data) => {
    mocks.loadMediaDetail.mockResolvedValue(data);
    expect((await generateMetadata(params())).robots).toEqual({ index: false, follow: true });
  });

  it("OG y X por título: tipo vídeo, URL, idioma y el fondo apaisado como imagen grande", async () => {
    const meta = await generateMetadata(params());
    expect(meta.openGraph).toMatchObject({
      type: "video.movie",
      url: `${BASE}/es/media/movie/550`,
      siteName: "KULTURA",
      locale: "es_ES",
      title: "El club de la lucha (1999) · KULTURA",
      images: [{ url: "https://image.tmdb.org/t/p/w1280/b.jpg", width: 1280, height: 720 }],
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("sin sinopsis, una descripción propia con el título (nunca vacía)", async () => {
    mocks.loadMediaDetail.mockResolvedValue(detail({ synopsis: undefined }));
    expect((await generateMetadata(params())).description).toBe('metaFallback:{"title":"El club de la lucha"}');
  });

  it("título que no existe → 'no encontrado' y noindex", async () => {
    mocks.loadMediaDetail.mockResolvedValue(null);
    const meta = await generateMetadata(params());
    expect(meta.title).toBe("Título no encontrado");
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});

describe("página de la ficha", () => {
  it("sin sesión: se pinta (sin redirigir) y no pide biblioteca ni afinidad", async () => {
    render(await MediaDetailPage(params()));
    expect(screen.getByTestId("media-detail")).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getMediaEntry).not.toHaveBeenCalled();
    expect(mocks.computeMatchScores).not.toHaveBeenCalled();
    expect(mocks.mediaDetailProps.current).toMatchObject({
      isAuthenticated: false,
      genreLabels: ["Suspense"],
      watchLink: "https://www.themoviedb.org/movie/550/watch?locale=ES",
      source: { name: "TMDB" },
    });
  });

  it("con sesión: biblioteca y afinidad del usuario", async () => {
    mocks.getViewer.mockResolvedValue({ user: { id: "u1" }, profile: { username: "ana" } });
    mocks.getMediaEntry.mockResolvedValue({ status: "pending" });
    mocks.computeMatchScores.mockResolvedValue(new Map([["movie_550", 80]]));
    render(await MediaDetailPage(params()));
    expect(mocks.getMediaEntry).toHaveBeenCalledWith("u1", "movie_550");
    expect(mocks.mediaDetailProps.current).toMatchObject({
      isAuthenticated: true,
      initialEntry: { status: "pending" },
      matchScore: 80,
    });
  });

  it("título que no existe → 404", async () => {
    mocks.loadMediaDetail.mockResolvedValue(null);
    await expect(MediaDetailPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("miga de pan: Inicio → ranking del formato (si existe) → título", async () => {
    render(await MediaDetailPage(params()));
    const year = new Date().getFullYear();
    expect(mocks.mediaDetailProps.current?.breadcrumbs).toEqual([
      { name: "Inicio", href: "/" },
      { name: "Películas", href: `/best/movie/${year}` },
    ]);
  });

  it("un libro (sin ranking) va de Inicio al título", async () => {
    mocks.loadMediaDetail.mockResolvedValue(detail({ id: "book_OL1W", externalId: "OL1W", type: "book" }));
    render(await MediaDetailPage(params("book", "OL1W")));
    expect(mocks.mediaDetailProps.current?.breadcrumbs).toEqual([{ name: "Inicio", href: "/" }]);
  });

  it("JSON-LD de la obra + BreadcrumbList, sin aggregateRating del proveedor", async () => {
    const { container } = render(await MediaDetailPage(params()));
    const script = container.querySelector('script[type="application/ld+json"]');
    const ld = JSON.parse(script!.innerHTML);
    const [work, crumbs] = ld["@graph"];
    expect(work["@type"]).toBe("Movie");
    expect(work.url).toBe(`${BASE}/es/media/movie/550`);
    expect(work.genre).toBe("Suspense");
    expect(work.aggregateRating).toBeUndefined();
    expect(crumbs.itemListElement.map((c: { item: string }) => c.item)).toEqual([
      `${BASE}/es`,
      `${BASE}/es/best/movie/${new Date().getFullYear()}`,
      `${BASE}/es/media/movie/550`,
    ]);
  });

  it("F-29: 'También existe como…' va como hueco en streaming, con o sin sesión", async () => {
    render(await MediaDetailPage(params()));
    const slot = mocks.mediaDetailProps.current?.adaptations as React.ReactElement<{ children: React.ReactElement<Record<string, unknown>> }>;
    expect(slot.props.children.props).toMatchObject({ item: { id: "movie_550" }, locale: "es", userId: null, supabase: null });
  });

  it("F-29: 'Compartir mi nota' solo con nota propia, con enlace firmado y en su escala", async () => {
    process.env.RATING_SCALE_10 = "1";
    mocks.getViewer.mockResolvedValue({ user: { id: "u1", user_metadata: { rating_scale: "ten" } }, profile: { username: "ana" } });
    mocks.getMediaEntry.mockResolvedValue({ status: "completed", score: 5, rating10: 9 });
    render(await MediaDetailPage(params()));
    const share = mocks.mediaDetailProps.current?.shareRating as { path: string; rating: string };
    expect(share.rating).toBe("9/10");
    expect(share.path).toMatch(/^\/es\/u\/ana\/r\/movie\/550\?s=[A-Za-z0-9_-]{22}&ref=ana$/);

    mocks.getMediaEntry.mockResolvedValue({ status: "pending", score: null, rating10: null });
    render(await MediaDetailPage(params()));
    expect(mocks.mediaDetailProps.current?.shareRating).toBeNull();

    mocks.getViewer.mockResolvedValue({ user: null, profile: null });
    render(await MediaDetailPage(params()));
    expect(mocks.mediaDetailProps.current?.shareRating).toBeNull();
    delete process.env.RATING_SCALE_10;
  });

  it("con nota de KULTURA, la ficha la enseña pero el JSON-LD no la marca", async () => {
    mocks.getKulturaRating.mockResolvedValue({ value: 4.5, count: 6 });
    const { container } = render(await MediaDetailPage(params()));
    const ld = container.querySelector('script[type="application/ld+json"]')!.innerHTML;
    expect(ld).not.toContain("aggregateRating");
    expect(mocks.mediaDetailProps.current?.kulturaRating).toEqual({ value: 4.5, count: 6 });
  });
});

describe("layout de la ficha", () => {
  it("sin sesión: cabecera y pie públicos, sin redirigir a login", async () => {
    render(await MediaLayout({ children: <p>ficha</p> }));
    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.getByTestId("public-footer")).toBeInTheDocument();
    expect(screen.queryByTestId("app-chrome")).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getUnreadCount).not.toHaveBeenCalled();
  });

  it("con sesión: el envoltorio de la app (cabecera, avisos y barra)", async () => {
    mocks.getViewer.mockResolvedValue({ user: { id: "u1" }, profile: { username: "ana" } });
    render(await MediaLayout({ children: <p>ficha</p> }));
    expect(screen.getByTestId("app-chrome")).toHaveAttribute("data-unread", "3");
    expect(screen.queryByTestId("public-header")).not.toBeInTheDocument();
  });

  it("los textos de la página van en su propio proveedor (REN-5), dentro del envoltorio", async () => {
    render(await MediaLayout({ children: <p>ficha</p> }));
    const provider = screen.getByTestId("client-messages");
    expect(provider).toHaveTextContent("ficha");
    expect(provider.dataset.ns).toContain("media_detail");
    expect(provider).not.toContainElement(screen.getByTestId("public-header"));
  });
});
