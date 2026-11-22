// ============================================================
// Fase 8.5 · F2a: la ficha con y sin la sala.
//
// - Con `sala=false` el HTML es el de siempre: las instantáneas se sacaron
//   del código de `master` ANTES de tocar `MediaDetail` (caracterización).
//   Si una cambia, la ficha de hoy ha cambiado.
// - Con `sala=true`: un solo `h1`, franja de datos y panel con la sinopsis y
//   los créditos; las acciones, «Dónde ver», tráiler y Steam siguen debajo.
// ============================================================

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { MediaItem, StreamingProvider } from "@/types/media";

vi.mock("next-intl/server", () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key)),
  getLocale: () => Promise.resolve("es"),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/media/TranslatedSynopsis", async () => {
  const { SynopsisSection } = await import("@/components/media/SynopsisSection");
  const { synopsisLang } = await import("@/lib/media/synopsis-lang");
  return {
    TranslatedSynopsis: ({ text, variant }: { text: string; variant?: "sala" }) => (
      <SynopsisSection text={text} lang={synopsisLang(text, "es")} {...(variant ? { variant } : {})} />
    ),
  };
});

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    loader: _loader,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; sizes?: string; loader?: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} {...rest} />;
  },
}));

// Las hojas de «Sala» van por next/dynamic: aquí no hacen falta.
vi.mock("@/components/media/sala/SalaFichaAssets", () => ({ SalaFichaAssets: () => null }));

vi.mock("@/components/media/TrailerEmbed", () => ({
  TrailerEmbed: ({ youtubeKey }: { youtubeKey: string }) => <div data-testid="trailer-embed" data-key={youtubeKey} />,
}));
vi.mock("@/components/library/LibraryAction", () => ({ LibraryAction: () => <div data-testid="library-action" /> }));
vi.mock("@/components/social/RecommendButton", () => ({ RecommendButton: () => <div data-testid="recommend-button" /> }));
vi.mock("@/components/social/ReportButton", () => ({ ReportButton: () => <div data-testid="report-button" /> }));
vi.mock("@/components/social/AddToListButton", () => ({ AddToListButton: () => <div data-testid="add-to-list-button" /> }));
vi.mock("@/components/media/StreamingProviders", () => ({
  StreamingProviders: ({ providers }: { providers: StreamingProvider[] }) => (
    <div data-testid="streaming-providers" data-count={providers.length} />
  ),
}));

import { MediaDetail } from "@/components/media/MediaDetail";

const movie: MediaItem = {
  id: "movie_496243",
  externalId: "496243",
  type: "movie",
  title: "Parásitos",
  originalTitle: "기생충",
  synopsis: "Tanto Gi Taek como su familia están sin trabajo.",
  year: 2019,
  rating: 8.5,
  ratingSource: "TMDB",
  genres: ["Comedia", "Suspense", "Drama"],
  poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
  backdrop: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
  metadata: { runtime: 132, director: "Bong Joon-ho", cast: ["Song Kang-ho", "Lee Sun-kyun"] },
};

const book: MediaItem = {
  id: "book_OL1",
  externalId: "OL1",
  type: "book",
  title: "Cien años de soledad",
  year: 1967,
  poster: "https://covers.openlibrary.org/b/id/1-L.jpg",
  synopsis: "La historia de la familia Buendía.",
  metadata: { pageCount: 471, authors: ["Gabriel García Márquez"], publisher: "Sudamericana" },
};

const game: MediaItem = {
  id: "game_3328",
  externalId: "3328",
  type: "game",
  title: "The Witcher 3: Wild Hunt",
  year: 2015,
  poster: "https://media.rawg.io/media/games/618/w3.jpg",
  rating: 4.7,
  ratingSource: "RAWG",
  metadata: { developers: ["CD PROJEKT RED"], platforms: ["PC", "PlayStation 4"] },
};

const bare: MediaItem = { id: "anime_1", externalId: "1", type: "anime", title: "Sin imagen" };

const providers: StreamingProvider[] = [{ name: "Netflix", logoPath: "https://img", type: "flatrate" }];

/** El HTML, con los `useId` de React normalizados (dependen del orden de los tests). */
const html = (el: Element) => el.innerHTML.replace(/_r_[a-z0-9]+_/g, "_r_");

const full = {
  providers,
  trailerKey: "abc",
  kulturaRating: { value: 4, count: 7 },
  breadcrumbs: [{ name: "Inicio", href: "/" }],
  adaptations: <section data-testid="adaptations-slot" />,
  matchScore: 80,
};

describe("MediaDetail con sala=false: el HTML de siempre", () => {
  for (const [name, item] of [
    ["película", movie],
    ["libro", book],
    ["juego", game],
    ["sin imagen", bare],
  ] as const) {
    it(`${name}, sin sesión`, async () => {
      const { container } = render(await MediaDetail({ item, initialEntry: null, isAuthenticated: false, ...full }));
      expect(html(container)).toMatchSnapshot();
    });
  }

  it("película, con sesión", async () => {
    const { container } = render(await MediaDetail({ item: movie, initialEntry: null, isAuthenticated: true, ...full }));
    expect(html(container)).toMatchSnapshot();
  });

  it("sala={false} explícito es lo mismo que sin la prop", async () => {
    const a = render(await MediaDetail({ item: movie, initialEntry: null, isAuthenticated: false, ...full }));
    const before = html(a.container);
    a.unmount();
    const b = render(await MediaDetail({ item: movie, initialEntry: null, isAuthenticated: false, ...full, sala: false }));
    expect(html(b.container)).toBe(before);
  });

  it("tiene su h1 de siempre, en la columna del póster", async () => {
    render(await MediaDetail({ item: movie, initialEntry: null, isAuthenticated: false }));
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Parásitos");
    expect(h1s[0].closest("[data-sala-ficha]")).toBeNull();
  });
});

describe("MediaDetail con sala=true (F2a)", () => {
  const sala = (item: MediaItem, more: Partial<Parameters<typeof MediaDetail>[0]> = {}) =>
    MediaDetail({ item, initialEntry: null, isAuthenticated: false, ...full, ...more, sala: true });

  it("un único h1, el de la sala", async () => {
    for (const item of [movie, book, game, bare]) {
      const { unmount } = render(await sala(item));
      const h1s = screen.getAllByRole("heading", { level: 1 });
      expect(h1s).toHaveLength(1);
      expect(h1s[0].closest("[data-sala-ficha]")).not.toBeNull();
      unmount();
    }
  });

  it("todo cuelga de un mismo contenedor sala-work: la paleta llega a la franja y a la ficha", async () => {
    const { container } = render(await sala(movie));
    const work = container.querySelectorAll(".sala-work");
    expect(work).toHaveLength(1);
    expect(work[0].querySelector("[data-sala-ficha]")).not.toBeNull();
    expect(work[0].querySelector("[data-sala-ficha-band]")).not.toBeNull();
    expect(within(work[0] as HTMLElement).getByRole("heading", { level: 2, name: "synopsis" })).toBeInTheDocument();
  });

  it("franja: año, tipo, duración, notas con su fuente y géneros, en texto", async () => {
    render(await sala(movie));
    const band = screen.getByRole("region", { name: "salaFactsLabel" });
    const facts = Array.from(band.querySelectorAll("[data-fact]")).map((el) => el.getAttribute("data-fact"));
    expect(facts).toEqual(["year", "type", "duration", "rating-kultura", "rating-provider", "genres"]);
    expect(within(band).getByText("movie")).toBeInTheDocument();
    expect(within(band).getByText("8,5/10")).toBeInTheDocument();
    expect(within(band).getByText('providerRatingLabel:{"source":"TMDB"}')).toHaveClass("sr-only");
    expect(within(band).getByText("Comedia, Suspense, Drama")).toBeInTheDocument();
  });

  it("panel: los créditos según el tipo; la sinopsis con los tokens de Sala", async () => {
    render(await sala(movie));
    const panel = screen.getByRole("complementary", { name: "details" });
    expect(within(panel).getByText("credits.director")).toBeInTheDocument();
    expect(within(panel).getByText("Bong Joon-ho")).toBeInTheDocument();
    expect(screen.getByText(movie.synopsis!)).toHaveClass("sala-type-lead");
    // Sin repetir la ficha de hoy: un solo bloque de sinopsis y de créditos.
    expect(screen.getAllByRole("heading", { name: "synopsis" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "details" })).toBeNull();
    expect(screen.queryByRole("list", { name: "ratingsLabel" })).toBeNull();
  });

  it("libro: autoría y editorial; sin la portada repetida en la columna", async () => {
    const { container } = render(await sala(book));
    const panel = screen.getByRole("complementary", { name: "details" });
    expect(within(panel).getByText("Gabriel García Márquez")).toBeInTheDocument();
    expect(within(panel).getByText("Sudamericana")).toBeInTheDocument();
    expect(container.querySelector("[data-library-stamp]")).toBeNull();
    expect(container.querySelectorAll('img[src*="openlibrary"]')).toHaveLength(1);
  });

  it("juego: la imagen de RAWG ya es la sala, no se repite en la columna", async () => {
    const { container } = render(await sala(game));
    expect(container.querySelectorAll('img[src*="rawg"]')).toHaveLength(1);
  });

  it("sin imagen: ni póster ni degradado con iniciales en la columna", async () => {
    render(await sala(bare));
    expect(screen.queryByText("SI")).toBeNull();
  });

  it("película: el póster vertical se queda en la columna (es otra imagen que la apaisada)", async () => {
    const { container } = render(await sala(movie));
    expect(container.querySelector('[data-library-stamp] img[src*="poster.jpg"]')).not.toBeNull();
  });

  it("las acciones, «Dónde ver», tráiler y adaptaciones siguen debajo, como hoy", async () => {
    render(await sala(movie, { isAuthenticated: true }));
    for (const id of [
      "library-action",
      "add-to-list-button",
      "recommend-button",
      "report-button",
      "streaming-providers",
      "trailer-embed",
      "adaptations-slot",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it("la miga de pan va en la ficha de Sala, una sola vez", async () => {
    render(await sala(movie));
    const navs = screen.getAllByRole("navigation", { name: "breadcrumbLabel" });
    expect(navs).toHaveLength(1);
    expect(navs[0].closest(".sala-work")).not.toBeNull();
    expect(navs[0].querySelector('[aria-current="page"]')).toHaveTextContent("Parásitos");
  });

  it("sinopsis larga: «leer más» de 48 px con el acento de la obra", async () => {
    render(await sala({ ...movie, synopsis: "x ".repeat(200) }));
    const more = screen.getByRole("button", { name: "readMore" });
    expect(more.className).toContain("min-h-sala-target");
    expect(more.className).toContain("text-sala-accent");
  });

  it("sin sinopsis ni créditos ni miga: solo la franja", async () => {
    const { container } = render(await sala(bare, { breadcrumbs: [] }));
    expect(screen.queryByRole("heading", { name: "synopsis" })).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(container.querySelector("[data-sala-ficha-band]")).not.toBeNull();
  });
});
