// ============================================================
// F-15 · MediaCard con `headingLevel` (ACC-7) y MediaGrid sin texto fijo (TXT-4)
// ============================================================

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
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

import { MediaCard } from "@/components/media/MediaCard";
import { MediaGrid } from "@/components/media/MediaGrid";

const item: MediaItem = { id: "movie_550", externalId: "550", type: "movie", title: "Fight Club", year: 1999 };

describe("MediaCard headingLevel", () => {
  it("por defecto h3 (como siempre)", () => {
    render(<MediaCard item={item} />);
    expect(screen.getByRole("heading", { level: 3, name: "Fight Club" })).toBeInTheDocument();
  });

  it.each([2, 4] as const)("h%s cuando la página lo pide", (level) => {
    render(<MediaCard item={item} headingLevel={level} />);
    expect(screen.getByRole("heading", { level, name: "Fight Club" })).toBeInTheDocument();
  });

  it("enlaza a la ficha pública", () => {
    render(<MediaCard item={item} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/media/movie/550");
  });

  it("las iniciales de relleno no se leen (el título ya está en el encabezado)", () => {
    render(<MediaCard item={item} />);
    expect(screen.getByText("FI")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("MediaGrid", () => {
  it("pasa el nivel a cada card", () => {
    render(<MediaGrid items={[{ ...item, poster: "https://image.tmdb.org/t/p/w500/p.jpg" }]} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  // TXT-4: era "No hay contenido disponible" fijo en español, también en /en.
  it("el estado vacío sale de los mensajes (media.noContent)", () => {
    render(<MediaGrid items={[]} />);
    expect(screen.getByText("media.noContent")).toBeInTheDocument();
  });
});
