import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { MediaItem } from "@/types/media";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; sizes?: string }) => {
    const { fill: _fill, priority: _priority, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

// next-intl en el entorno de test no puede resolver next/navigation —
// mockeamos @/i18n/navigation con un <a> simple.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// R6: MediaCard usa useTranslations("discoverFilters.typeBadge") para el badge.
// Mock con el mapa singular ES real (movie → "Película").
vi.mock("next-intl", () => {
  const TYPE_BADGE: Record<string, string> = {
    movie: "Película", tv: "Serie", anime: "Anime", book: "Libro",
    manga: "Manga", game: "Videojuego", comic: "Cómic",
  };
  return { useTranslations: () => (key: string) => TYPE_BADGE[key] ?? key };
});

import { MediaCard } from "@/components/media/MediaCard";

const baseItem: MediaItem = {
  id: "movie_550",
  externalId: "550",
  type: "movie",
  title: "Fight Club",
  year: 1999,
  rating: 8.8,
  ratingSource: "TMDB",
};

describe("MediaCard", () => {
  it("renderiza el título del item", () => {
    render(<MediaCard item={baseItem} />);
    expect(screen.getByText("Fight Club")).toBeInTheDocument();
  });

  it("renderiza el año cuando existe", () => {
    render(<MediaCard item={baseItem} />);
    expect(screen.getByText("1999")).toBeInTheDocument();
  });

  it("no muestra año cuando no existe", () => {
    const itemNoYear: MediaItem = { ...baseItem, year: undefined };
    render(<MediaCard item={itemNoYear} />);
    expect(screen.queryByText("1999")).not.toBeInTheDocument();
  });

  it("muestra placeholder cuando no hay poster", () => {
    render(<MediaCard item={baseItem} />);
    // No poster = placeholder div should exist
    expect(document.querySelector("[data-placeholder]")).toBeInTheDocument();
  });

  it("renderiza imagen cuando hay poster", () => {
    const itemWithPoster: MediaItem = {
      ...baseItem,
      poster: "https://image.tmdb.org/t/p/w500/poster.jpg",
    };
    render(<MediaCard item={itemWithPoster} />);
    // La portada es decorativa (`aria-hidden`), así que NO tiene rol `img`:
    // se busca por etiqueta. Ver el bloque E-CARD-PORTADA-404 de abajo.
    expect(document.querySelector("img")).toBeInTheDocument();
  });

  // ── Una portada rota deja color, no el icono del navegador ───────────────
  //
  // Visto en Descubrir → Libros: las portadas de Open Library dan 404 a
  // menudo, y la card enseñaba el icono de imagen rota CON el título en texto
  // crudo —encima del título de verdad que la card ya pinta debajo—. Mismo
  // patrón que ya resolvía `PosterTile` en la landing: el gradiente va detrás.
  it("el respaldo de gradiente está SIEMPRE, también con poster", () => {
    const itemWithPoster: MediaItem = {
      ...baseItem,
      poster: "https://covers.openlibrary.org/b/id/123-L.jpg",
    };
    render(<MediaCard item={itemWithPoster} />);
    const placeholder = document.querySelector("[data-placeholder]");
    const img = document.querySelector("img");
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveClass("absolute", "inset-0");
    // Y va ANTES que la imagen en el DOM: así la portada se pinta encima y,
    // si da 404, lo que queda debajo es el color.
    expect(
      placeholder!.compareDocumentPosition(img!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("la portada es decorativa: alt vacío, para que un 404 no escupa el título", () => {
    const itemWithPoster: MediaItem = {
      ...baseItem,
      poster: "https://covers.openlibrary.org/b/id/123-L.jpg",
    };
    render(<MediaCard item={itemWithPoster} />);
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
    // El título sigue siendo accesible: va como texto en el <h3>.
    expect(screen.getByText("Fight Club")).toBeInTheDocument();
  });

  // ── El cero no es un año (E-CARD-ANO-CERO) ───────────────────────────────
  //
  // `{item.year && <p/>}` evalúa a 0 cuando el año es 0, y React pinta ese
  // número suelto como texto — fuera del <p> y sin sus estilos. Salió en
  // pantalla con "The War of the Worlds" y "The Invisible Man".
  it("un año de 0 no pinta un '0' suelto", () => {
    const itemZeroYear: MediaItem = { ...baseItem, year: 0 };
    render(<MediaCard item={itemZeroYear} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("muestra badge de tipo (label localizado) cuando showType=true", () => {
    // R5b: el badge usa TYPE_LABEL (movie → "Película"), no el slug crudo.
    render(<MediaCard item={baseItem} showType />);
    expect(screen.getByText("Película")).toBeInTheDocument();
  });

  it("no muestra badge de tipo por defecto", () => {
    render(<MediaCard item={baseItem} />);
    expect(screen.queryByText("Película")).not.toBeInTheDocument();
  });

  // E-MATCH-SIN-BADGE: el porcentaje de afinidad se retiró de la UI. El match
  // se sigue calculando (es el criterio de las recomendaciones IA), pero la
  // card no lo pinta en ninguna superficie.
  it("no pinta badge de match", () => {
    render(<MediaCard item={baseItem} />);
    expect(screen.queryByTestId("media-match-badge")).not.toBeInTheDocument();
    expect(screen.queryByText(/MATCH/i)).not.toBeInTheDocument();
  });
});
