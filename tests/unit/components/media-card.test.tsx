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
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
  });

  it("muestra badge de tipo cuando showType=true", () => {
    render(<MediaCard item={baseItem} showType />);
    expect(screen.getByText("movie")).toBeInTheDocument();
  });

  it("no muestra badge de tipo por defecto", () => {
    render(<MediaCard item={baseItem} />);
    expect(screen.queryByText("movie")).not.toBeInTheDocument();
  });
});
