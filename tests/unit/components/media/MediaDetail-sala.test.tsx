// ============================================================
// Fase 8.5 · F2a: la ficha con y sin la sala.
//
// - Con `sala=false` el HTML es el de siempre: las instantáneas se sacaron
//   del código de `master` ANTES de tocar `MediaDetail` (caracterización).
//   Si una cambia, la ficha de hoy ha cambiado.
// - Con `sala=true`: un solo `h1`, franja de datos y panel con la sinopsis y
//   los créditos; F2c: el resto (acciones, «Dónde ver», Steam, fuentes)
//   también en «Sala», sin adaptaciones; F3: el tráiler también, al final.
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

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => "es",
}));

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
// F3: el tráiler de Sala llega por next/dynamic (SalaTrailerLazy); aquí, el de verdad.
vi.mock("@/components/media/sala/SalaTrailerLazy", async () => ({
  SalaTrailerLazy: (await import("@/components/media/sala/SalaTrailer")).SalaTrailer,
}));
vi.mock("@/components/library/LibraryAction",() => ({ LibraryAction: () => <div data-testid="library-action" /> }));
// F2b: la biblioteca de Sala llega por next/dynamic (SalaLibraryLazy); aquí, directa.
vi.mock("@/components/library/sala/SalaLibraryLazy", async () => ({
  SalaLibraryActionLazy: ({ mediaId, toastLabels }: { mediaId: string; toastLabels: { region: string } }) => (
    <div data-testid="sala-library-action" data-media={mediaId} data-region={toastLabels.region} />
  ),
  SalaLibraryCtaLazy: (await import("@/components/library/sala/SalaLibraryCta")).SalaLibraryCta,
}));
// `data-skin`: con `sala`, los disparadores son de «Sala» (F2c). Sin la prop no se pinta.
vi.mock("@/components/social/RecommendButton", () => ({
  RecommendButton: ({ skin }: { skin?: string }) => <div data-testid="recommend-button" data-skin={skin} />,
}));
vi.mock("@/components/social/ReportButton", () => ({
  ReportButton: ({ skin }: { skin?: string }) => <div data-testid="report-button" data-skin={skin} />,
}));
vi.mock("@/components/social/AddToListButton", () => ({
  AddToListButton: ({ skin }: { skin?: string }) => <div data-testid="add-to-list-button" data-skin={skin} />,
}));
vi.mock("@/components/media/StreamingProviders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/media/StreamingProviders")>()),
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

/** Una clave de YouTube que vale (la de `full`, "abc", es la de las instantáneas de siempre). */
const YT = "dQw4w9WgXcQ";

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
    expect(facts).toEqual(["year", "type", "duration", "rating-kultura", "rating-provider", "genres", "original-language"]);
    expect(within(band).getByText("movie")).toBeInTheDocument();
    // «Formato» en la franja (decisión de Víctor); la ficha de hoy sigue con «Tipo».
    expect(within(band).getByText("format")).toBeInTheDocument();
    expect(within(band).queryByText("type")).toBeNull();
    // Nombrada por un h2 oculto, no por aria-label.
    expect(band).not.toHaveAttribute("aria-label");
    expect(within(band).getByRole("heading", { level: 2, name: "salaFactsLabel" })).toHaveClass("sr-only");
    expect(within(band).getByText("8,5/10")).toBeInTheDocument();
    expect(within(band).getByText('providerRatingLabel:{"source":"TMDB"}')).toHaveClass("sr-only");
    expect(within(band).getByText("Comedia, Suspense, Drama")).toBeInTheDocument();
  });

  it("panel: los créditos según el tipo; la sinopsis con los tokens de Sala", async () => {
    render(await sala(movie));
    const panel = screen.getByRole("region", { name: "details" });
    expect(within(panel).getByText("credits.director")).toBeInTheDocument();
    expect(within(panel).getByText("Bong Joon-ho")).toBeInTheDocument();
    expect(screen.getByText(movie.synopsis!)).toHaveClass("sala-type-lead");
    // Sin repetir la ficha de hoy: un solo bloque de sinopsis y de créditos.
    expect(screen.getAllByRole("heading", { name: "synopsis" })).toHaveLength(1);
    // Los créditos llevan su propio h2 (visible), una sola vez.
    expect(screen.getAllByRole("heading", { level: 2, name: "details" })).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "ratingsLabel" })).toBeNull();
  });

  it("con imagen apaisada, la franja sigue el tema de la página; sin ella, el de la sala, con un filete", async () => {
    const { unmount, container } = render(await sala(movie));
    const stageBand = container.querySelector("[data-sala-ficha-band]")!;
    expect(stageBand).not.toHaveAttribute("data-theme");
    expect(stageBand.querySelector("dl")!.className).not.toContain("border-t-2");
    unmount();
    for (const item of [book, bare, { ...movie, backdrop: undefined }]) {
      const r = render(await sala(item));
      const band = r.container.querySelector("[data-sala-ficha-band]")!;
      expect(band).toHaveAttribute("data-theme", "dark");
      expect(band.querySelector("dl")!.className).toContain("border-t-2 border-sala-band-ink");
      r.unmount();
    }
  });

  it("libro: autoría y editorial; sin la portada repetida en la columna", async () => {
    const { container } = render(await sala(book));
    const panel = screen.getByRole("region", { name: "details" });
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

  it("película (F2b): sin póster vertical en la columna, como el prototipo", async () => {
    const { container } = render(await sala(movie));
    expect(container.querySelector("[data-library-stamp]")).toBeNull();
    expect(container.querySelector('img[src*="poster.jpg"]')).toBeNull();
  });

  it("F2b: con sesión, la biblioteca va en la sala (Sala) y no en la columna de hoy", async () => {
    const { container } = render(await sala(movie, { isAuthenticated: true }));
    const region = screen.getByRole("region", { name: "salaLibraryLabel" });
    expect(region.closest(".sala-work")).not.toBeNull();
    expect(within(region).getByRole("heading", { level: 2, name: "salaLibraryLabel" })).toHaveClass("sr-only");
    const action = within(region).getByTestId("sala-library-action");
    expect(action).toHaveAttribute("data-media", movie.id);
    expect(action).toHaveAttribute("data-region", "salaToastRegion");
    expect(screen.queryByTestId("library-action")).toBeNull();
    // Antes de la sinopsis: en móvil, lo primero debajo de la franja.
    const synopsis = screen.getByRole("heading", { level: 2, name: "synopsis" });
    expect(region.compareDocumentPosition(synopsis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('a[href*="mode=register"]')).toHaveLength(0);
  });

  it("F2b: sin sesión, «Añadir a mi biblioteca» y «Entra» van en la sala, una sola vez", async () => {
    const { container } = render(await sala(book));
    const region = screen.getByRole("region", { name: "salaLibraryLabel" });
    const add = within(region).getByRole("link", { name: "ctaAdd" });
    expect(add.getAttribute("href")).toContain("mode=register");
    expect(add.className).toContain("min-h-sala-target");
    expect(within(region).getByRole("link", { name: "ctaLogin" }).className).toContain("min-h-sala-target");
    expect(within(region).getByText(/ctaHint/)).toBeInTheDocument();
    expect(container.querySelectorAll('a[href*="mode=register"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href*="mode=login"]')).toHaveLength(1);
    // F2c: denunciar sin cuenta también va en «Sala», una sola vez.
    const report = screen.getAllByRole("link", { name: "reportPublic" });
    expect(report).toHaveLength(1);
    expect(report[0].closest(".sala-work")).not.toBeNull();
    expect(report[0].getAttribute("href")).toContain("/report?target=media&id=book_OL1");
    expect(report[0]).toHaveAttribute("rel", "nofollow");
    expect(report[0].className).toContain("min-h-sala-target");
  });

  it("F2b: la biblioteca de Sala llega por next/dynamic (no pesa en la ficha con la bandera apagada)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/media/MediaDetail.tsx", "utf8");
    expect(src).toContain("@/components/library/sala/SalaLibraryLazy");
    expect(src).not.toMatch(/from "@\/components\/library\/sala\/SalaLibrary(Action|Cta)"/);
    const lazy = readFileSync("src/components/library/sala/SalaLibraryLazy.tsx", "utf8");
    expect(lazy).toContain('import("./SalaLibraryAction")');
    expect(lazy).toContain('import("./SalaLibraryCta")');
  });

  it("F2c: las demás acciones y «Dónde ver» van en «Sala»", async () => {
    const { container } = render(await sala(movie, { isAuthenticated: true, trailerKey: YT }));
    const work = container.querySelector(".sala-work") as HTMLElement;
    for (const id of ["add-to-list-button", "recommend-button", "report-button"]) {
      const el = screen.getByTestId(id);
      expect(el.closest(".sala-work")).toBe(work);
      expect(el).toHaveAttribute("data-skin", "sala");
    }
    const more = screen.getByRole("region", { name: "salaMoreActionsLabel" });
    expect(within(more).getByRole("heading", { level: 2, name: "salaMoreActionsLabel" })).toHaveClass("sr-only");
    // Sin adaptaciones con «Sala» (decisión de Víctor), aunque la página las pase.
    expect(screen.queryByTestId("adaptations-slot")).toBeNull();
    // «Dónde ver» es el de «Sala», no el de hoy.
    expect(screen.queryByTestId("streaming-providers")).toBeNull();
    expect(within(work).getByRole("heading", { level: 2, name: "whereToWatch" })).toBeInTheDocument();
    // El tráiler (F3): el de «Sala», dentro de la obra y una sola vez; el de hoy, no.
    expect(screen.queryByTestId("trailer-embed")).toBeNull();
    expect(screen.getAllByRole("heading", { name: "trailer" })).toHaveLength(1);
    expect(within(work).getByRole("region", { name: "trailer" })).toBeInTheDocument();
    // Ni la columna de hoy ni su biblioteca.
    expect(screen.queryByTestId("library-action")).toBeNull();
    expect(container.querySelectorAll("[data-testid=add-to-list-button]")).toHaveLength(1);
  });

  it("F2c/F3: el orden de abajo: acciones, por qué, dónde ver, Steam, tráiler y fuentes", async () => {
    const { container } = render(
      await sala(movie, {
        isAuthenticated: true,
        trailerKey: YT,
        source: { name: "TMDB", url: "https://www.themoviedb.org/movie/496243" },
        steam: { appId: 1, storeUrl: "https://store.steampowered.com/app/1", isFree: true },
      })
    );
    const order = Array.from(container.querySelectorAll("[data-sala-ficha-more] > *")).map(
      (el) =>
        el.getAttribute("data-testid") ??
        Array.from(el.attributes)
          .map((a) => a.name)
          .find((n) => n.startsWith("data-sala-ficha-"))
    );
    expect(order).toEqual([
      "data-sala-ficha-more-actions",
      undefined, // «Por qué te lo recomendamos» (sin data-)
      "data-sala-ficha-watch",
      "data-sala-ficha-steam",
      "data-sala-ficha-trailer",
      "data-sala-ficha-sources",
    ]);
  });

  it("F3: tráiler en marco 16:9 con la imagen de la obra; nada de YouTube antes de pulsar", async () => {
    const { container } = render(await sala(movie, { trailerKey: YT }));
    const region = screen.getByRole("region", { name: "trailer" });
    expect(within(region).getByRole("heading", { level: 2, name: "trailer" })).toHaveClass("sala-type-heading");
    expect(region.querySelector(".aspect-video")).not.toBeNull();
    // Ni iframe ni miniatura de YouTube: el fondo es la apaisada de la obra.
    expect(region.querySelector("iframe")).toBeNull();
    expect(container.innerHTML).not.toMatch(/youtube|ytimg/);
    const img = region.querySelector("img")!;
    expect(img).toHaveAttribute("src", movie.backdrop);
    expect(img).toHaveAttribute("alt", "");
    // El botón: texto visible al principio del nombre (2.5.3), con el título; el aviso es su descripción.
    const button = within(region).getByRole("button", {
      name: `salaTrailerPlay:${JSON.stringify({ title: movie.title })}`,
    });
    expect(button).toHaveTextContent("trailerPlay");
    expect(button).toHaveAccessibleDescription("trailerNotice");
    expect(button.className).toContain("min-h-sala-target");
    expect(button.className).toContain("sala-focused:sala-focus");
    // Sala: sin radios ni sombras.
    expect(region.innerHTML).not.toMatch(/rounded|shadow/);
  });

  it("F3: al pulsar, youtube-nocookie en reproducción, con título, y el foco en el reproductor", async () => {
    const { fireEvent } = await import("@testing-library/react");
    render(await sala(movie, { trailerKey: ` ${YT}\t` }));
    const region = screen.getByRole("region", { name: "trailer" });
    fireEvent.click(within(region).getByRole("button"));
    const iframe = region.querySelector("iframe")!;
    expect(iframe).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&rel=0`);
    expect(iframe).toHaveAttribute("title", `trailerTitle:${JSON.stringify({ title: movie.title })}`);
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(document.activeElement).toBe(iframe);
    expect(within(region).queryByRole("button")).toBeNull();
  });

  it("F3: libro sin apaisada: la portada de fondo; sin imagen, el panel liso", async () => {
    const a = render(await sala(book, { trailerKey: YT }));
    expect(within(a.container).getByRole("region", { name: "trailer" }).querySelector("img")).toHaveAttribute(
      "src",
      book.poster
    );
    a.unmount();
    const b = render(await sala(bare, { trailerKey: YT }));
    expect(within(b.container).getByRole("region", { name: "trailer" }).querySelector("img")).toBeNull();
  });

  it("F3: sin tráiler, o con una clave que no vale, no se pinta nada", async () => {
    for (const trailerKey of [undefined, "abc", 'x"><script>']) {
      const { container, unmount } = render(await sala(movie, { trailerKey }));
      expect(within(container).queryByRole("region", { name: "trailer" })).toBeNull();
      expect(within(container).queryByRole("heading", { name: "trailer" })).toBeNull();
      expect(container.querySelector("[data-sala-trailer], iframe")).toBeNull();
      unmount();
    }
  });

  it("F3: el tráiler de Sala llega por next/dynamic (no pesa en la ficha con la bandera apagada)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/components/media/MediaDetail.tsx", "utf8");
    expect(src).toContain('from "./sala/SalaTrailerLazy"');
    expect(src).not.toMatch(/from "\.\/sala\/SalaTrailer"/);
    expect(readFileSync("src/components/media/sala/SalaTrailerLazy.tsx", "utf8")).toContain('import("./SalaTrailer")');
  });

  it("F2c: «Por qué te lo recomendamos» con su h2, solo con señal", async () => {
    render(await sala(movie));
    const why = screen.getByRole("region", { name: "whyRecommended" });
    expect(why.closest(".sala-work")).not.toBeNull();
    expect(within(why).getByText(/whyRecommendedText/)).toHaveClass("sala-type-text");
    const r = render(await sala(movie, { matchScore: undefined }));
    expect(within(r.container).queryByRole("region", { name: "whyRecommended" })).toBeNull();
  });

  it("F2c: «Dónde ver» se desliza; cada plataforma es un enlace que avisa de que abre otra web", async () => {
    const { container } = render(
      await sala(movie, {
        providers: [
          { name: "Netflix", logoPath: "https://img/n", type: "flatrate" },
          { name: "Netflix", logoPath: "https://img/n", type: "flatrate" },
          { name: "Apple TV", logoPath: "https://img/a", type: "rent" },
        ],
        watchLink: "https://www.themoviedb.org/movie/496243/watch?locale=ES",
      })
    );
    const watch = screen.getByRole("region", { name: "whereToWatch" });
    const row = watch.querySelector("[data-sala-watch-row]")!;
    expect(row.className).toContain("overflow-x-auto");
    // Sale hasta el borde de la retícula (`page-grid`) y respeta ese margen.
    expect(row.className).toContain("scroll-px-4");
    expect(row.className).toContain("md:scroll-px-8");
    // Todo son enlaces: la fila no es otra parada del tabulador.
    expect(row).not.toHaveAttribute("tabindex");
    expect(within(watch).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "watchType.flatrate",
      "watchType.rent",
    ]);
    const links = within(watch).getAllByRole("link", { name: /salaProviderLinkLabel/ });
    expect(links).toHaveLength(2); // sin repetidos
    // El nombre accesible lleva la modalidad (la misma plataforma puede estar en dos).
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
      'salaProviderLinkLabel:{"name":"Netflix","type":"flatrate"}',
      'salaProviderLinkLabel:{"name":"Apple TV","type":"rent"}',
    ]);
    // Sin recorte del nombre; la flecha va fuera del texto.
    const name = within(watch).getByText("Apple TV");
    expect(name.className).not.toContain("line-clamp");
    expect(name.querySelector("svg")).toBeNull();
    expect(links[1].querySelector(":scope > svg[aria-hidden='true']")).not.toBeNull();
    for (const a of links) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
      expect(a.getAttribute("href")).toMatch(/^https:\/\/www\.themoviedb\.org\//);
      expect(a.className).toContain("min-h-sala-target");
    }
    // El nombre se ve; el logo es adorno.
    expect(within(watch).getByText("Apple TV")).toBeInTheDocument();
    expect(watch.querySelector('img[src="https://img/a"]')).toHaveAttribute("alt", "");
    // La cita de JustWatch, siempre, con su logo y su enlace.
    expect(within(watch).getByText("justwatchAttribution")).toBeInTheDocument();
    const jw = within(watch).getByRole("link", { name: "justwatchLinkLabel" });
    expect(jw).toHaveAttribute("href", "https://www.justwatch.com/es");
    expect(within(jw).getByRole("img", { name: "JustWatch" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-sala-ficha-watch]")).toHaveLength(1);
  });

  it("F2c: si una plataforma no tiene enlace, la fila entra en el teclado (para moverla con las flechas)", async () => {
    render(await sala(movie, { providers: [{ name: "Filmin", logoPath: "https://img/f", type: "flatrate" }], watchLink: undefined }));
    const watch = screen.getByRole("region", { name: "whereToWatch" });
    const row = watch.querySelector("[data-sala-watch-row]")!;
    expect(row).toHaveAttribute("tabindex", "0");
    expect(row).toHaveAttribute("role", "group");
    expect(row).toHaveAttribute("aria-labelledby", "sala-ficha-watch");
    expect(within(watch).queryByRole("link", { name: /salaProviderLinkLabel/ })).toBeNull();
  });

  it("F2c: juego con Steam: precio, idiomas, capturas con nombre y enlace a la tienda, en «Sala»", async () => {
    render(
      await sala(game, {
        steam: {
          appId: 292030,
          storeUrl: "https://store.steampowered.com/app/292030",
          isFree: false,
          price: "9,99€",
          priceOriginal: "29,99€",
          discountPercent: 67,
          supportedLanguages: ["Español", "English"],
          screenshots: [
            { thumb: "https://cdn/s1.jpg", full: "https://cdn/s1-full.jpg" },
            { thumb: "https://cdn/s2.jpg", full: "https://cdn/s2-full.jpg" },
          ],
          metacritic: 93,
        },
      })
    );
    const steam = screen.getByRole("region", { name: "steamTitle" });
    expect(steam.closest(".sala-work")).not.toBeNull();
    expect(within(steam).getByText("9,99€")).toBeInTheDocument();
    expect(within(steam).getByText("29,99€").tagName).toBe("S");
    // El descuento se anuncia como tal, no solo «menos 67 por ciento».
    const discountLabel = within(steam).getByText("steamDiscount");
    expect(discountLabel).toHaveClass("sr-only");
    expect(discountLabel.parentElement!.textContent).toMatch(/^steamDiscount\s*−67%$/);
    expect(within(steam).getByText("93")).toBeInTheDocument();
    expect(within(steam).getByText("Español, English")).toBeInTheDocument();
    const shots = within(steam).getAllByRole("link", { name: /steamScreenshotLink/ });
    expect(shots).toHaveLength(2);
    expect(shots[1]).toHaveAccessibleName('steamScreenshotLink:{"n":2,"total":2} newTab');
    expect(shots[1]).toHaveAttribute("target", "_blank");
    const store = within(steam).getByRole("link", { name: /steamViewOnStore/ });
    expect(store).toHaveAttribute("href", "https://store.steampowered.com/app/292030");
    expect(store).toHaveAttribute("target", "_blank");
    // jsdom junta el texto oculto sin el espacio; el navegador lo lee «… (se abre en una pestaña nueva)».
    expect(store).toHaveAccessibleName(/^steamViewOnStore\s*newTab$/);
  });

  it("F2c: la fuente del título (RAWG) va en «Sala», visible y con su enlace", async () => {
    render(await sala(game, { source: { name: "RAWG", url: "https://rawg.io/games/the-witcher-3-wild-hunt" } }));
    const link = screen.getByRole("link", { name: /^RAWG\s*newTab$/ });
    expect(link.closest(".sala-work")).not.toBeNull();
    expect(link).toHaveAttribute("href", "https://rawg.io/games/the-witcher-3-wild-hunt");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.className).toContain("min-h-sala-target");
    expect(link.closest("p")).toHaveTextContent("sourceLabel");
    expect(link.closest("p")!.className).not.toContain("sr-only");
    expect(screen.getAllByText("sourceLabel")).toHaveLength(1);
  });

  it("F2c: Google Books: el logo «Powered by Google» y el enlace al libro, en «Sala»", async () => {
    render(
      await sala(
        { ...book, id: "book_zyTCAlFPjgYC", externalId: "zyTCAlFPjgYC" },
        { source: { name: "Google Books", url: "https://books.google.com/books?id=zyTCAlFPjgYC" } }
      )
    );
    const attributions = screen.getAllByTestId("google-books-attribution");
    expect(attributions).toHaveLength(1);
    expect(attributions[0].closest(".sala-work")).not.toBeNull();
    expect(within(attributions[0]).getByRole("img")).toBeInTheDocument();
    const link = within(attributions[0]).getByRole("link", { name: /^googleBooksLink\s*newTab$/ });
    expect(link).toHaveAttribute("href", "https://books.google.com/books?id=zyTCAlFPjgYC");
    // La fuente «Google Books» no se repite como «Datos del título».
    expect(screen.queryByText("sourceLabel")).toBeNull();
  });

  it("la miga de pan va en la ficha de Sala, una sola vez", async () => {
    render(await sala(movie));
    const navs = screen.getAllByRole("navigation", { name: "breadcrumbLabel" });
    expect(navs).toHaveLength(1);
    expect(navs[0].closest(".sala-work")).not.toBeNull();
    expect(navs[0].querySelector('[aria-current="page"]')).toHaveTextContent("Parásitos");
    expect(navs[0].querySelector('[aria-current="page"]')).toHaveClass("line-clamp-2");
  });

  it("sinopsis larga: «leer más» de 48 px con el acento de la obra", async () => {
    render(await sala({ ...movie, synopsis: "x ".repeat(200) }));
    const more = screen.getByRole("button", { name: "readMore" });
    expect(more.className).toContain("min-h-sala-target");
    expect(more.className).toContain("text-sala-accent");
  });

  it("el corte de la sinopsis no parte caracteres de fuera del BMP", async () => {
    // 279 letras y un emoji (dos unidades UTF-16) en la posición 280, y más texto detrás.
    const text = "a".repeat(279) + "😀" + "b".repeat(40);
    render(await sala({ ...movie, synopsis: text }));
    expect(screen.getByText("a".repeat(279) + "😀…")).toBeInTheDocument();
  });

  it("F4: si el original ya va bajo el rótulo, la franja da solo el idioma original", async () => {
    const { unmount } = render(await sala({ ...movie, metadata: { ...movie.metadata, originalLanguage: "ko" } }));
    const band = screen.getByRole("region", { name: "salaFactsLabel" });
    expect(band.querySelector('[data-fact="original-title"]')).toBeNull();
    const fact = band.querySelector('[data-fact="original-language"]')!;
    expect(within(fact as HTMLElement).getByText("originalLanguage")).toBeInTheDocument();
    expect(fact.querySelector("dd")!.textContent).toBe("coreano");
    // El título original sale una sola vez: bajo el rótulo, con su `lang`.
    expect(screen.getAllByText("기생충")).toHaveLength(1);
    unmount();

    // Sin idioma conocido no hay nada que añadir.
    const s = render(await sala({ ...movie, originalTitle: "Original sin escritura" }));
    expect(document.querySelector('[data-fact="original-language"]')).toBeNull();
    s.unmount();

    // Igual que el título que se ve: no se pinta nada.
    render(await sala({ ...movie, originalTitle: undefined }));
    expect(document.querySelector('[data-fact^="original-"]')).toBeNull();
  });

  it("F4: si el rótulo enseña otro (el nativo), la franja da el título original con su idioma", async () => {
    render(
      await sala({
        id: "anime_al-199",
        externalId: "al-199",
        type: "anime",
        title: "Spirited Away",
        originalTitle: "Sen to Chihiro no Kamikakushi",
        metadata: { nativeTitle: "千と千尋の神隠し" },
      })
    );
    const fact = document.querySelector('[data-fact="original-title"]')!;
    expect(within(fact as HTMLElement).getByText("originalTitle")).toBeInTheDocument();
    const romaji = within(fact as HTMLElement).getByText("Sen to Chihiro no Kamikakushi");
    expect(romaji).toHaveAttribute("lang", "ja-Latn");
    // El nombre del idioma, en el de la página y fuera del `lang` del título.
    expect(fact.querySelector("dd")!.textContent).toBe("Sen to Chihiro no Kamikakushi· japonés");
    expect(document.querySelector('[data-fact="original-language"]')).toBeNull();
  });

  it("F4: anime sin apaisada: la vertical grande de AniList llena la sala hasta 480 px; luego, libro", async () => {
    const anime: MediaItem = {
      id: "anime_al-199",
      externalId: "al-199",
      type: "anime",
      title: "Spirited Away",
      poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx199-sWefXJvXkDOb.jpg",
    };
    const { container } = render(await sala(anime));
    const hero = container.querySelector("[data-sala-ficha]")!;
    expect(hero).toHaveAttribute("data-sala-ficha", "poster");
    const stage = hero.querySelector(".sala-stage")!;
    expect(stage).toHaveAttribute("data-sala-fill", "480");
    // Una sola imagen (la grande) y un solo h1, dentro de la sala.
    const imgs = hero.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute("src")).toContain("/cover/large/");
    expect(within(stage as HTMLElement).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // La franja va con la sala (tema oscuro y filete), como en el libro.
    expect(container.querySelector("[data-sala-ficha-band]")).toHaveAttribute("data-theme", "dark");
  });

  it("F4: película sin apaisada (TMDB): llena a cualquier ancho; lo comprueba el cliente al cargar", async () => {
    const { container } = render(await sala({ ...movie, backdrop: undefined }));
    expect(container.querySelector("[data-sala-ficha]")).toHaveAttribute("data-sala-ficha", "poster");
    expect(container.querySelector(".sala-stage")).toHaveAttribute("data-sala-fill", "all");
  });

  it("F4: anime que es película: «Película de anime» y lo que dura, en vez de «Episodios: 1»", async () => {
    const chihiro: MediaItem = {
      id: "anime_al-199",
      externalId: "al-199",
      type: "anime",
      title: "Spirited Away",
      year: 2001,
      metadata: { format: "MOVIE", duration: 125, episodes: 1, studio: "Studio Ghibli" },
    };
    const { unmount } = render(await sala(chihiro));
    const band = screen.getByRole("region", { name: "salaFactsLabel" });
    const facts = Array.from(band.querySelectorAll("[data-fact]")).map((el) => el.getAttribute("data-fact"));
    expect(facts).toEqual(["year", "type", "duration", "rating-kultura"]);
    expect(within(band).getByText("formatAnimeMovie")).toBeInTheDocument();
    expect(within(band).getByText('durationValue:{"minutes":125}')).toBeInTheDocument();
    expect(within(band).queryByText("anime")).toBeNull();
    unmount();

    // Sin duración, el dato de siempre; una serie de anime sigue siendo «anime».
    const r = render(await sala({ ...chihiro, metadata: { format: "MOVIE", episodes: 1 } }));
    expect(within(screen.getByRole("region", { name: "salaFactsLabel" })).getByText("1")).toBeInTheDocument();
    r.unmount();
    render(await sala({ ...chihiro, metadata: { format: "TV", duration: 24, episodes: 26 } }));
    const tv = screen.getByRole("region", { name: "salaFactsLabel" });
    expect(within(tv).getByText("anime")).toBeInTheDocument();
    expect(within(tv).getByText("26")).toBeInTheDocument();
  });

  it("F4: con sala=false, un anime que es película sigue como hoy", async () => {
    const chihiro: MediaItem = {
      id: "anime_al-199",
      externalId: "al-199",
      type: "anime",
      title: "Spirited Away",
      metadata: { format: "MOVIE", duration: 125, episodes: 1 },
    };
    render(await MediaDetail({ item: chihiro, initialEntry: null, isAuthenticated: false }));
    expect(screen.queryByText("formatAnimeMovie")).toBeNull();
    expect(screen.getByText("anime")).toBeInTheDocument();
  });

  it("sin sinopsis ni créditos ni miga: solo la franja", async () => {
    const { container } = render(await sala(bare, { breadcrumbs: [] }));
    expect(screen.queryByRole("heading", { name: "synopsis" })).toBeNull();
    expect(screen.queryByRole("region", { name: "details" })).toBeNull();
    expect(container.querySelector("[data-sala-ficha-band]")).not.toBeNull();
  });
});

describe("MediaDetail · F5b: la apaisada sin rótulo, solo en la sala", () => {
  const TEXTLESS = "https://image.tmdb.org/t/p/w1280/sin-rotulo.jpg";
  const extras = { backdrop: TEXTLESS };

  it("con sala, la cabecera y el fondo del tráiler usan la apaisada sin rótulo, directa de TMDB", async () => {
    const { container } = render(
      await MediaDetail({ item: movie, initialEntry: null, isAuthenticated: false, trailerKey: YT, sala: true, salaExtras: extras })
    );
    const stage = container.querySelector("[data-sala-ficha]")!;
    expect(stage).toHaveAttribute("data-sala-ficha", "stage");
    expect(stage.querySelector("img")).toHaveAttribute("src", TEXTLESS);
    const trailer = screen.getByRole("region", { name: "trailer" });
    expect(trailer.querySelector("img")).toHaveAttribute("src", TEXTLESS);
    // La de siempre no se pinta en ningún sitio de la sala.
    expect(container.innerHTML).not.toContain(movie.backdrop);
  });

  it("una obra sin apaisada pasa a la sala completa si llega la sin rótulo", async () => {
    const { container } = render(
      await MediaDetail({
        item: { ...movie, backdrop: undefined },
        initialEntry: null,
        isAuthenticated: false,
        sala: true,
        salaExtras: extras,
      })
    );
    expect(container.querySelector("[data-sala-ficha]")).toHaveAttribute("data-sala-ficha", "stage");
    expect(container.querySelector("[data-sala-ficha-band]")).not.toHaveAttribute("data-theme");
  });

  it("con sala=false, los extras no cambian nada", async () => {
    const a = render(await MediaDetail({ item: movie, initialEntry: null, isAuthenticated: false, ...full }));
    const before = html(a.container);
    a.unmount();
    const b = render(
      await MediaDetail({ item: movie, initialEntry: null, isAuthenticated: false, ...full, salaExtras: extras })
    );
    expect(html(b.container)).toBe(before);
    expect(b.container.innerHTML).not.toContain(TEXTLESS);
  });
});

describe("MediaDetail · F5c: anime de AniList cruzado con TMDB", () => {
  const frieren: MediaItem = {
    id: "anime_al-154587",
    externalId: "al-154587",
    type: "anime",
    title: "Frieren",
    poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/frieren.jpg",
  };
  const source = { name: "AniList", url: "https://anilist.co/anime/154587" };
  const tmdbProviders: StreamingProvider[] = [
    { name: "Crunchyroll", logoPath: "https://image.tmdb.org/t/p/w92/cr.jpg", type: "flatrate" },
  ];
  const extras = {
    backdrop: "https://image.tmdb.org/t/p/w1280/sin.jpg",
    trailerKey: YT,
    providers: tmdbProviders,
    watchLink: "https://www.themoviedb.org/tv/209867/watch?locale=ES",
    extraSource: { name: "TMDB", url: "https://www.themoviedb.org/tv/209867" },
  };

  it("sala completa con la imagen de TMDB, tráiler, «Dónde ver» con JustWatch y dos líneas de fuente", async () => {
    const { container } = render(
      await MediaDetail({ item: frieren, initialEntry: null, isAuthenticated: false, source, sala: true, salaExtras: extras })
    );
    expect(container.querySelector("[data-sala-ficha]")).toHaveAttribute("data-sala-ficha", "stage");
    expect(screen.getByRole("region", { name: "trailer" })).toBeInTheDocument();
    const watch = screen.getByRole("region", { name: "whereToWatch" });
    expect(within(watch).getByAltText("JustWatch")).toBeInTheDocument();
    const sources = container.querySelector("[data-sala-ficha-sources]")!;
    const lines = Array.from(sources.querySelectorAll("p")).map((p) => p.textContent);
    expect(lines[0]).toContain("sourceLabel");
    expect(lines[0]).toContain("AniList");
    const extra = sources.querySelector("[data-sala-ficha-extra-source]")!;
    expect(extra).toHaveTextContent("extraSourceLabel");
    expect(within(extra as HTMLElement).getByRole("link")).toHaveAttribute("href", "https://www.themoviedb.org/tv/209867");
  });

  it("lo propio manda: el tráiler y «Dónde ver» de la ficha no se cambian por los de TMDB", async () => {
    const own: StreamingProvider[] = [{ name: "Netflix", logoPath: "https://image.tmdb.org/t/p/w92/n.jpg", type: "flatrate" }];
    render(
      await MediaDetail({
        item: frieren,
        initialEntry: null,
        isAuthenticated: false,
        source,
        trailerKey: "ownTrailer1",
        providers: own,
        sala: true,
        salaExtras: extras,
      })
    );
    const watch = screen.getByRole("region", { name: "whereToWatch" });
    expect(watch).toHaveTextContent("Netflix");
    expect(watch).not.toHaveTextContent("Crunchyroll");
  });

  it("con sala=false, nada de TMDB en la ficha de siempre", async () => {
    const { container } = render(
      await MediaDetail({ item: frieren, initialEntry: null, isAuthenticated: false, source, salaExtras: extras })
    );
    expect(container.innerHTML).not.toContain("themoviedb.org/tv/209867");
    expect(container.innerHTML).not.toContain("Crunchyroll");
    expect(container.innerHTML).not.toContain("extraSourceLabel");
  });
});
