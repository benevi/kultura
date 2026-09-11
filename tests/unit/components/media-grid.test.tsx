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

  // F3a→F3b: matchScores se propaga a cada MediaCard por id.
  it("propaga matchScores a cada MediaCard por id", () => {
    const items = [makeItem(1), makeItem(2)];
    const matchScores = new Map([["movie_1", 92]]);
    render(<MediaGrid items={items} matchScores={matchScores} />);
    const badges = screen.getAllByTestId("media-match-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("92% MATCH");
  });
});
