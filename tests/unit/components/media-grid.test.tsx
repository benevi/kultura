import { fireEvent, render, screen } from "@testing-library/react";
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

// R6: MediaGrid renderiza MediaCard, que usa useTranslations para el badge.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { MediaGrid } from "@/components/media/MediaGrid";

const makeItem = (n: number): MediaItem => ({
  id: `movie_${n}`,
  externalId: String(n),
  type: "movie",
  title: `Movie ${n}`,
  year: 2000 + n,
  poster: `https://image.tmdb.org/t/p/w500/p${n}.jpg`,
});

describe("MediaGrid", () => {
  it("renderiza N MediaCards para N items", () => {
    const items = [makeItem(1), makeItem(2), makeItem(3)];
    render(<MediaGrid items={items} />);
    expect(screen.getByText("Movie 1")).toBeInTheDocument();
    expect(screen.getByText("Movie 2")).toBeInTheDocument();
    expect(screen.getByText("Movie 3")).toBeInTheDocument();
  });

  it("muestra mensaje vacío cuando items=[]", () => {
    render(<MediaGrid items={[]} emptyMessage="No hay contenido" />);
    expect(screen.getByText("No hay contenido")).toBeInTheDocument();
  });

  it("muestra mensaje vacío por defecto cuando items=[] sin emptyMessage", () => {
    render(<MediaGrid items={[]} />);
    // Should show some empty state
    expect(document.querySelector("[data-empty]")).toBeInTheDocument();
  });

  it("muestra placeholders cuando loading=true", () => {
    render(<MediaGrid items={[]} loading />);
    // Should show shimmer placeholders
    expect(document.querySelector("[data-loading]")).toBeInTheDocument();
  });

  it("no renderiza MediaCards cuando loading=true aunque haya items", () => {
    const items = [makeItem(1)];
    render(<MediaGrid items={items} loading />);
    // In loading state, real items should not be shown
    expect(screen.queryByText("Movie 1")).not.toBeInTheDocument();
  });

  // F3b: layout='bento' es opt-in — no cambia el default de consumidores existentes.
  it("renderiza items con layout='bento' sin romper el render", () => {
    const items = [makeItem(1), makeItem(2)];
    render(<MediaGrid items={items} layout="bento" />);
    expect(screen.getByText("Movie 1")).toBeInTheDocument();
    expect(screen.getByText("Movie 2")).toBeInTheDocument();
  });

  // E-MATCH-SIN-BADGE: el grid ya no recibe ni propaga puntuaciones de match;
  // ninguna card pinta el porcentaje.
  it("no pinta badges de match en ninguna card", () => {
    render(<MediaGrid items={[makeItem(1), makeItem(2)]} />);
    expect(screen.queryAllByTestId("media-match-badge")).toHaveLength(0);
  });

  // E-SIN-CARDS-VACIAS: el catálogo no enseña cards sin portada.
  it("no pinta los items sin portada (salvo con requirePoster=false)", () => {
    const sinPortada = { ...makeItem(9), poster: undefined };
    const { unmount } = render(<MediaGrid items={[makeItem(1), sinPortada]} />);
    expect(screen.getByText("Movie 1")).toBeInTheDocument();
    expect(screen.queryByText("Movie 9")).toBeNull();
    unmount();
    render(<MediaGrid items={[makeItem(1), sinPortada]} requirePoster={false} />);
    expect(screen.getByText("Movie 9")).toBeInTheDocument();
  });

  it("saca de la rejilla la card cuya portada no carga", () => {
    const { container } = render(<MediaGrid items={[makeItem(1), makeItem(2)]} />);
    const img = container.querySelector('img[src*="p2.jpg"]') as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.queryByText("Movie 2")).toBeNull();
    expect(screen.getByText("Movie 1")).toBeInTheDocument();
  });
});
