import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { MediaItem, StreamingProvider } from "@/types/media";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

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

vi.mock("@/components/media/StreamingProviders", () => ({
  StreamingProviders: ({
    providers,
    title,
  }: {
    providers: StreamingProvider[];
    title: string;
  }) => (
    <div data-testid="streaming-providers" data-count={providers.length}>
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
    const images = screen.getAllByAltText("Fight Club");
    const posterImg = images.find((img) =>
      img.getAttribute("src")?.includes("poster.jpg")
    );
    expect(posterImg).toBeInTheDocument();
  });

  it("Hero renderiza fondo fallback (backdrop blur) cuando no hay poster ni backdrop", async () => {
    render(await MediaDetail({ item: mockItemMinimal, initialEntry: null, isAuthenticated: false }));
    // Sin poster: muestra initials placeholder con texto
    expect(screen.getByText("EL")).toBeInTheDocument();
  });

  it("Hero usa backdrop como fondo borroso cuando existe", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    const images = screen.getAllByAltText("Fight Club");
    const backdropImg = images.find((img) =>
      img.getAttribute("src")?.includes("backdrop.jpg")
    );
    expect(backdropImg).toBeInTheDocument();
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

  it("renderiza el rating con la fuente en el hero y en detalles", async () => {
    render(await MediaDetail({ item: mockItem, initialEntry: null, isAuthenticated: false }));
    expect(screen.getAllByText("8.4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("TMDB").length).toBeGreaterThan(0);
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
});
