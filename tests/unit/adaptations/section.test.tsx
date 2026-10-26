// ============================================================
// F-29 · "También existe como…" en la ficha (PRO-11)
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AdaptationView } from "@/lib/adaptations/display";

const h = vi.hoisted(() => ({
  getAdaptations: vi.fn(),
  buildAdaptationView: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) =>
    (key: string, values?: Record<string, unknown>) =>
      namespace === "media" ? `T:${key}` : values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ src }: { src: string }) => <img src={src} data-testid="poster" />,
}));
vi.mock("@/lib/adaptations/load", () => ({ getAdaptations: h.getAdaptations }));
vi.mock("@/lib/adaptations/display", () => ({ buildAdaptationView: h.buildAdaptationView }));
vi.mock("@/components/media/AddFranchiseButton", () => ({
  AddFranchiseButton: ({ items }: { items: unknown[] }) => <button data-testid="add-franchise" data-count={items.length} />,
}));

import { AdaptationsSection } from "@/components/media/AdaptationsSection";

const ITEM = { id: "movie_438631", type: "movie" as const, externalId: "438631", title: "Dune" };

const VIEW: AdaptationView = {
  cards: [
    { mediaId: "book_OL893415W", type: "book", externalId: "OL893415W", title: "Dune", year: 1965, poster: "https://covers.openlibrary.org/b/id/1-L.jpg", relation: "source", inLibrary: false },
    { mediaId: "movie_841", type: "movie", externalId: "841", title: "Dune (1984)", relation: "sibling", inLibrary: true },
    { mediaId: "anime_al-1", type: "anime", externalId: "al-1", title: "Algo", relation: "franchise", inLibrary: false },
  ],
  addable: [
    { mediaId: "book_OL893415W", title: "Dune" },
    { mediaId: "anime_al-1", title: "Algo" },
  ],
};

async function renderSection(props: Partial<Parameters<typeof AdaptationsSection>[0]> = {}) {
  const el = await AdaptationsSection({ item: ITEM, locale: "es", userId: null, supabase: null, ...props });
  return el ? render(el) : null;
}

beforeEach(() => {
  h.getAdaptations.mockReset().mockResolvedValue({ links: [{ mediaId: "book_OL893415W" }], source: "table" });
  h.buildAdaptationView.mockReset().mockResolvedValue(VIEW);
});

describe("AdaptationsSection", () => {
  it("sin vínculos no pinta nada (ni hueco ni título)", async () => {
    h.getAdaptations.mockResolvedValue({ links: [], source: "none" });
    expect(await AdaptationsSection({ item: ITEM, locale: "es", userId: null, supabase: null })).toBeNull();
    expect(h.buildAdaptationView).not.toHaveBeenCalled();
  });

  it("título, tarjetas enlazadas a su ficha con formato, año y relación", async () => {
    await renderSection();
    expect(screen.getByRole("heading", { level: 2, name: "title" })).toBeInTheDocument();
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/es/media/"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/es/media/book/OL893415W",
      "/es/media/movie/841",
      "/es/media/anime/al-1",
    ]);
    expect(links[0]).toHaveTextContent("Dune");
    expect(links[0]).toHaveTextContent('meta:{"type":"T:book","year":"1965"}');
    expect(links[0]).toHaveTextContent("relation.source");
    expect(links[1]).toHaveTextContent("T:movie");
    expect(links[1]).toHaveTextContent("inLibrary");
    // Gradiente siempre detrás; portada solo si la hay.
    expect(screen.getAllByTestId("poster")).toHaveLength(1);
  });

  it("cita la fuente: Wikidata, en pestaña nueva y con su etiqueta", async () => {
    await renderSection();
    const wd = screen.getByRole("link", { name: "sourceLinkLabel" });
    expect(wd).toHaveAttribute("href", "https://www.wikidata.org/");
    expect(wd).toHaveAttribute("target", "_blank");
    expect(wd).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("sin sesión: enlace para entrar y volver aquí, sin botón", async () => {
    await renderSection();
    expect(screen.queryByTestId("add-franchise")).toBeNull();
    expect(screen.getByRole("link", { name: "loginToAdd" })).toHaveAttribute(
      "href",
      "/es/login?mode=login&next=%2Fes%2Fmedia%2Fmovie%2F438631"
    );
  });

  it("con sesión: 'Añadir toda la franquicia' con lo que falta", async () => {
    await renderSection({ userId: "u1", supabase: {} as never });
    expect(screen.getByTestId("add-franchise")).toHaveAttribute("data-count", "2");
    expect(h.buildAdaptationView).toHaveBeenCalledWith(expect.any(Array), { locale: "es", userId: "u1", supabase: {} });
  });

  it("con sesión y todo ya en la biblioteca: lo dice en vez del botón", async () => {
    h.buildAdaptationView.mockResolvedValue({ ...VIEW, addable: [] });
    await renderSection({ userId: "u1", supabase: {} as never });
    expect(screen.queryByTestId("add-franchise")).toBeNull();
    expect(screen.getByText("add.allIn")).toBeInTheDocument();
  });
});
