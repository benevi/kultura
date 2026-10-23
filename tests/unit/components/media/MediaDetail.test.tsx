import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { MediaItem, StreamingProvider } from "@/types/media";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl/server", () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key
    ),
  getLocale: () => Promise.resolve("es"),
}));

// `Link` de next-intl: en la app antepone el idioma; aquí basta un <a>.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
}));

// E-SINOPSIS-I18N: la sinopsis va dentro de un <Suspense> con el texto
// ORIGINAL como fallback. `TranslatedSynopsis` es un Server Component async y
// react-dom no lo sabe renderizar aquí, así que se sustituye por su versión
// sin traducción: lo que estos tests comprueban (truncado, "leer más") vive en
// `SynopsisSection` y sigue ejercitándose igual.
vi.mock("@/components/media/TranslatedSynopsis", async () => {
  const { SynopsisSection } = await import("@/components/media/SynopsisSection");
  const { synopsisLang } = await import("@/lib/media/synopsis-lang");
  return {
    // Igual que el real cuando no hay traducción: el original con su `lang`.
    TranslatedSynopsis: ({ text }: { text: string }) => (
      <SynopsisSection text={text} lang={synopsisLang(text, "es")} />
    ),
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} {...rest} />;
  },
}));

vi.mock("@/components/media/TrailerEmbed", () => ({
  TrailerEmbed: ({ youtubeKey, title }: { youtubeKey: string; title: string }) => (
    <div data-testid="trailer-embed" data-key={youtubeKey} data-title={title} />
  ),
}));

vi.mock("@/components/library/LibraryAction", () => ({
  LibraryAction: () => <div data-testid="library-action" />,
}));

vi.mock("@/components/social/RecommendButton", () => ({
  RecommendButton: () => <div data-testid="recommend-button" />,
}));

vi.mock("@/components/social/ReportButton", () => ({
  ReportButton: () => <div data-testid="report-button" />,
}));

vi.mock("@/components/social/AddToListButton", () => ({
  AddToListButton: () => <div data-testid="add-to-list-button" />,
}));

vi.mock("@/components/media/StreamingProviders", () => ({
  StreamingProviders: ({
    providers,
    title,
    link,
  }: {
    providers: StreamingProvider[];
    title: string;
    link?: string;
  }) => (
    <div data-testid="streaming-providers" data-count={providers.length} data-link={link ?? ""}>
      {title}
    </div>
  ),
}));

// Import AFTER mocks
import { MediaDetail } from "@/components/media/MediaDetail";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LONG_SYNOPSIS =
  "Esta es una sinopsis muy larga para probar la funcionalidad de truncado. " +
  "Contiene mucho texto que supera los doscientos ochenta caracteres para asegurar " +
  "que el componente SynopsisSection muestre el botón de leer más correctamente. " +
  "Añadimos más texto para asegurarnos de superar el límite establecido en el componente.";

const mockItem: MediaItem = {
  id: "movie_550",
  externalId: "550",
  type: "movie",
  title: "Fight Club",
  originalTitle: "Fight Club",
  synopsis: "Un hombre insomne y un vendedor de jabón forman un club clandestino.",
  year: 1999,
  rating: 8.4,
  ratingSource: "TMDB",
  genres: ["Drama", "Thriller"],
  poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
  backdrop: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
};

const mockItemMinimal: MediaItem = {
  id: "book_OL1234",
  externalId: "OL1234",
  type: "book",
  title: "El Quijote",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MediaDetail", () => {
  it("Hero renderiza el título", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByRole("heading", { name: "Fight Club", level: 1 })).toBeInTheDocument();
  });

  it("Hero renderiza el año cuando existe", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getAllByText("1999").length).toBeGreaterThan(0);
  });

  it("Hero renderiza el poster cuando existe", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    const images = Array.from(document.querySelectorAll("img"));
    const posterImg = images.find((img) =>
      img.getAttribute("src")?.includes("poster.jpg")
    );
    expect(posterImg).toBeInTheDocument();
  });

  it("Poster renderiza degradado con iniciales cuando no hay poster real", async () => {
    render(await MediaDetail({ item: mockItemMinimal, initialEntry: null, isAuthenticated: false }));
    // Sin poster: muestra el degradado de fallback con las iniciales del título
    expect(screen.getByText("EL")).toBeInTheDocument();
  });

  // F0: MediaDetail usa un layout de dos columnas (poster + info) sin hero de
  // backdrop a sangre — ese patrón era de la iteración F4, previa al canvas
  // F0 ("Kultura Editorial"). `item.backdrop` ya no se pinta como imagen de
  // fondo aparte; el poster real (o su degradado) es la única imagen del
  // bloque izquierdo. Este caso cubre que un item con backdrop no rompe nada
  // y sigue mostrando su poster real con normalidad.
  it("Un item con backdrop sigue mostrando su poster real con normalidad", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    const images = Array.from(document.querySelectorAll("img"));
    const posterImg = images.find((img) => img.getAttribute("src")?.includes("poster.jpg"));
    const backdropImg = images.find((img) => img.getAttribute("src")?.includes("backdrop.jpg"));
    expect(posterImg).toBeInTheDocument();
    expect(backdropImg).toBeUndefined();
  });

  it("Synopsis corta se muestra completa sin botón 'leer más'", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(
      screen.getByText("Un hombre insomne y un vendedor de jabón forman un club clandestino.")
    ).toBeInTheDocument();
    expect(screen.queryByText("readMore")).not.toBeInTheDocument();
  });

  it("Synopsis larga (>280 chars) muestra texto truncado y botón 'leer más'", async () => {
    const itemLong = { ...mockItem, synopsis: LONG_SYNOPSIS };
    render(await MediaDetail({ item: itemLong, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByText("readMore")).toBeInTheDocument();
  });

  it("Click en 'leer más' expande la synopsis y muestra 'leer menos'", async () => {
    const itemLong = { ...mockItem, synopsis: LONG_SYNOPSIS };
    render(await MediaDetail({ item: itemLong, initialEntry: null, isAuthenticated: false }));
    fireEvent.click(screen.getByText("readMore"));
    expect(screen.getByText("readLess")).toBeInTheDocument();
  });

  it("renderiza los géneros como chips", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("Thriller")).toBeInTheDocument();
  });

  it("renderiza la nota del proveedor con su fuente y su escala (/10), en formato del idioma", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByText("8,4/10")).toBeInTheDocument();
    expect(screen.getByText("TMDB")).toBeInTheDocument();
    expect(screen.getByText('providerRatingLabel:{"source":"TMDB"}:', { exact: false })).toHaveClass("sr-only");
  });

  it("Streaming providers se renderizan cuando existen", async () => {
    const providers: StreamingProvider[] = [
      { name: "Netflix", logoPath: "https://img", type: "flatrate" },
    ];
    render(await MediaDetail({ item: mockItem, providers, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByTestId("streaming-providers")).toBeInTheDocument();
  });

  it("Sin streaming providers: sección no visible", async () => {
    render(await MediaDetail({ item: mockItem, providers: [], initialEntry: null, isAuthenticated: false }));
    expect(screen.queryByTestId("streaming-providers")).not.toBeInTheDocument();
  });

  it("Sin streaming providers undefined: sección no visible", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.queryByTestId("streaming-providers")).not.toBeInTheDocument();
  });

  it("renderiza TrailerEmbed cuando se pasa trailerKey", async () => {
    render(await MediaDetail({ item: mockItem, trailerKey: "abc123", initialEntry: null, isAuthenticated: false }));
    expect(screen.getByTestId("trailer-embed")).toHaveAttribute("data-key", "abc123");
  });

  it("no renderiza TrailerEmbed cuando no hay trailerKey", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.queryByTestId("trailer-embed")).not.toBeInTheDocument();
  });

  it("no muestra RecommendButton cuando no está autenticado", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.queryByTestId("recommend-button")).not.toBeInTheDocument();
  });

  it("muestra RecommendButton cuando está autenticado", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: true }));
    expect(screen.getByTestId("recommend-button")).toBeInTheDocument();
  });

  it("no rompe cuando el item no tiene synopsis, géneros ni rating", async () => {
    render(await MediaDetail({ item: mockItemMinimal, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByRole("heading", { name: "El Quijote", level: 1 })).toBeInTheDocument();
  });

  it("no muestra originalTitle cuando coincide con el título", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    // originalTitle === title → solo aparece una vez en el h1
    const headings = screen.getAllByText("Fight Club");
    expect(headings).toHaveLength(1);
  });

  it("muestra originalTitle cuando es diferente al título", async () => {
    const itemWithOriginal: MediaItem = {
      ...mockItem,
      title: "El club de la lucha",
      originalTitle: "Fight Club",
    };
    render(await MediaDetail({ item: itemWithOriginal, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByText("El club de la lucha")).toBeInTheDocument();
    expect(screen.getByText("Fight Club")).toBeInTheDocument();
  });

  // E-MATCH-SIN-BADGE: el badge colgante con el porcentaje se retiró. El
  // `matchScore` sigue llegando, pero solo como compuerta de la sección "Por
  // qué te lo recomendamos" — su valor no se enseña en ninguna parte.
  it("no pinta el badge de match aunque llegue matchScore", async () => {
    render(
      await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false, matchScore: 82 })
    );
    expect(screen.queryByTestId("media-match-badge")).not.toBeInTheDocument();
    expect(screen.queryByText(/82\s*%/)).not.toBeInTheDocument();
  });

  it("con matchScore y géneros, explica el porqué sin dar un porcentaje", async () => {
    render(
      await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false, matchScore: 82 })
    );
    expect(screen.getByText(/whyRecommended$/)).toBeInTheDocument();
  });

  it("sin matchScore no hay sección de porqué (no sabemos nada de sus gustos)", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.queryByText(/whyRecommended$/)).not.toBeInTheDocument();
  });

  // ── D-01: ficha pública ─────────────────────────────────────────────────────

  it("es la región principal de la página (un <main> con id para saltar)", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("sin sesión: CTA al registro con `next` de vuelta a la ficha, sin biblioteca", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    const cta = screen.getByRole("link", { name: /ctaAdd/ });
    expect(cta).toHaveAttribute("href", "/es/login?mode=register&next=%2Fes%2Fmedia%2Fmovie%2F550");
    expect(cta).toHaveAttribute("rel", "nofollow");
    expect(screen.getByRole("link", { name: "ctaLogin" })).toHaveAttribute(
      "href",
      "/es/login?mode=login&next=%2Fes%2Fmedia%2Fmovie%2F550"
    );
    expect(screen.queryByTestId("library-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("add-to-list-button")).not.toBeInTheDocument();
  });

  it("sin sesión: la denuncia enlaza al formulario público con el título ya puesto", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByRole("link", { name: "reportPublic" })).toHaveAttribute(
      "href",
      "/es/report?target=media&id=movie_550"
    );
    expect(screen.queryByTestId("report-button")).not.toBeInTheDocument();
  });

  it("con sesión: biblioteca, listas, recomendar y denunciar; sin CTA de registro", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: true }));
    for (const id of ["library-action", "add-to-list-button", "recommend-button", "report-button"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: /ctaAdd/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "reportPublic" })).not.toBeInTheDocument();
  });

  it("pinta los géneros en el idioma de la página si llegan (F-06)", async () => {
    render(
      await MediaDetail({
        item: mockItem,
        genreLabels: ["Drama", "Suspense"],
        initialEntry: null,
        isAuthenticated: false,
      })
    );
    expect(screen.getByText("Suspense")).toBeInTheDocument();
    expect(screen.queryByText("Thriller")).not.toBeInTheDocument();
  });

  it("pasa el enlace 'dónde ver' de TMDB a StreamingProviders (F-07)", async () => {
    const link = "https://www.themoviedb.org/movie/550/watch?locale=ES";
    const providers: StreamingProvider[] = [{ name: "Netflix", logoPath: "https://img", type: "flatrate" }];
    render(
      await MediaDetail({ item: mockItem, providers, watchLink: link, initialEntry: null, isAuthenticated: false })
    );
    expect(screen.getByTestId("streaming-providers")).toHaveAttribute("data-link", link);
  });

  it("cita la fuente con un enlace activo a la ficha del proveedor (RAWG la exige)", async () => {
    const game: MediaItem = { id: "game_3498", externalId: "3498", type: "game", title: "GTA V" };
    render(
      await MediaDetail({
        item: game,
        source: { name: "RAWG", url: "https://rawg.io/games/grand-theft-auto-v" },
        initialEntry: null,
        isAuthenticated: false,
      })
    );
    const a = screen.getByRole("link", { name: /sourceLinkLabel/ });
    expect(a).toHaveAttribute("href", "https://rawg.io/games/grand-theft-auto-v");
    expect(a).toHaveTextContent("RAWG");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });

  // Revisión del PR #40: 4,0 (KULTURA, 1-5) y 8,4 (TMDB, 0-10) salían juntas
  // con los datos y sin escala.
  it("las dos notas van en su propia fila, separadas de los datos y cada una con su etiqueta y escala", async () => {
    render(
      await MediaDetail({
        item: mockItem,
        kulturaRating: { value: 4, count: 7 },
        initialEntry: null,
        isAuthenticated: false,
      })
    );
    const ratings = screen.getByRole("list", { name: "ratingsLabel" });
    const items = Array.from(ratings.querySelectorAll("li")).map((li) => li.textContent);
    expect(items[0]).toContain("kulturaRatingLabel");
    expect(items[0]).toContain("4,0/5");
    expect(items[0]).toContain('kulturaRatingHint:{"count":7}');
    expect(items[1]).toContain("TMDB");
    expect(items[1]).toContain("8,4/10");
    // La fila de datos (año, tipo, duración) no lleva notas.
    const facts = screen.getByText("1999").closest("ul")!;
    expect(facts).not.toBe(ratings);
    expect(facts.textContent).not.toContain("/10");
  });

  it("sin notas no hay fila de notas", async () => {
    render(await MediaDetail({ item: mockItemMinimal, initialEntry: null, isAuthenticated: false }));
    expect(screen.queryByRole("list", { name: "ratingsLabel" })).not.toBeInTheDocument();
  });

  // Revisión del PR #40: a 390 px el CTA caía hacia 805 px (bajo la BottomNav).
  it("en móvil el póster es una banda de 260 px (3:4 desde sm) y el final respeta el área segura", async () => {
    const { container } = render(
      await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false })
    );
    const poster = screen.getByRole("heading", { level: 1 }).closest("div[class*='rounded-[32px]']")!;
    expect(poster.className).toContain("h-[260px]");
    expect(poster.className).toContain("sm:aspect-[3/4]");
    expect(poster.className).not.toMatch(/(^| )aspect-\[3\/4\]/);
    expect(container.querySelector("main > div")!.className).toContain(
      "pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
    );
  });

  it("una sinopsis en otro idioma que la página lleva `lang` (WCAG 3.1.2)", async () => {
    const english = {
      ...mockItem,
      synopsis: "A depressed man and a soap salesman build an underground fight club with the help of the others.",
    };
    render(await MediaDetail({ item: english, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByText(english.synopsis)).toHaveAttribute("lang", "en");
  });

  it("una sinopsis en el idioma de la página no lleva `lang`", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByText(mockItem.synopsis!)).not.toHaveAttribute("lang");
  });

  it("las etiquetas de los chips se leen como texto (no `aria-label` en un span)", async () => {
    const { container } = render(
      await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false })
    );
    expect(container.querySelector("span[aria-label]")).toBeNull();
    expect(screen.getByText("year:", { exact: false })).toHaveClass("sr-only");
  });

  it("un libro dice páginas, no episodios", async () => {
    const book: MediaItem = { ...mockItemMinimal, metadata: { pageCount: 320, authors: ["Cervantes"] } };
    render(await MediaDetail({ item: book, initialEntry: null, isAuthenticated: false }));
    expect(screen.getByText("pages:", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("episodes:", { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText("credits.authors")).toBeInTheDocument();
    expect(screen.getByText("Cervantes")).toBeInTheDocument();
  });

  it("miga de pan con el título como página actual", async () => {
    render(
      await MediaDetail({
        item: mockItem,
        breadcrumbs: [
          { name: "Inicio", href: "/" },
          { name: "Películas", href: "/best/movie/2026" },
        ],
        initialEntry: null,
        isAuthenticated: false,
      })
    );
    const nav = screen.getByRole("navigation", { name: "breadcrumbLabel" });
    expect(nav.querySelector('a[href="/es/best/movie/2026"]')).toHaveTextContent("Películas");
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent("Fight Club");
  });
});
