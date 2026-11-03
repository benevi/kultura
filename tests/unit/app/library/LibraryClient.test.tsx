import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LibraryEntry, LibraryStatus } from "@/types/library";

// useTranslations: (key) => key, con los valores pegados para verlos.
vi.mock("next-intl", () => {
  const t = (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key);
  t.has = () => true;
  return { useTranslations: () => t, useLocale: () => "es" };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToastContext: () => ({ show: vi.fn(), showError: vi.fn(), dismiss: vi.fn() }),
}));

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

let current = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => current,
}));

vi.mock("@/components/media/PosterImage", () => ({ PosterImage: () => null }));

import { LibraryClient } from "@/app/[locale]/(app)/library/LibraryClient";
import { ALBUM_PAGE_SIZE } from "@/components/library/AlbumView";

function entry(i: number, status: LibraryStatus, extra: Partial<LibraryEntry> & Record<string, unknown> = {}): LibraryEntry {
  return {
    id: `e${i}`,
    userId: "u",
    mediaId: `movie_${i}`,
    status,
    score: null,
    watchedAt: null,
    episodeProgress: null,
    createdAt: `2026-01-${String(i).padStart(2, "0")}T10:00:00Z`,
    title: `Título ${i}`,
    ...extra,
  } as LibraryEntry;
}

const ENTRIES: LibraryEntry[] = [
  entry(1, "completed"),
  entry(2, "completed"),
  entry(3, "completed"),
  entry(4, "in_progress"),
  entry(5, "pending"),
  entry(6, "pending"),
];

function statusCount(status: LibraryStatus): string | null {
  const button = document.querySelector(`[data-status-count="${status}"]`);
  return button?.querySelector("span:last-child")?.textContent ?? null;
}

describe("Biblioteca — resumen por estado", () => {
  beforeEach(() => {
    current = new URLSearchParams();
    mockPush.mockReset();
  });

  it("cuenta cada estado, con cero para los que no hay", () => {
    render(<LibraryClient entries={ENTRIES} />);
    expect(statusCount("completed")).toBe("3");
    expect(statusCount("in_progress")).toBe("1");
    expect(statusCount("pending")).toBe("2");
    expect(statusCount("abandoned")).toBe("0");
  });

  // Son el resumen de la biblioteca, no el resultado del filtro: con el filtro
  // de estado puesto, los otros estados no se quedan a cero.
  it("cuenta la biblioteca entera aunque haya un filtro activo", () => {
    current = new URLSearchParams("status=pending");
    const { container } = render(<LibraryClient entries={ENTRIES} />);
    expect(container.querySelectorAll("[data-album-item]")).toHaveLength(2);
    expect(statusCount("completed")).toBe("3");
    expect(document.querySelector('[data-status-count="pending"]')).toHaveAttribute("aria-pressed", "true");
  });

  // WIG: los recuentos con el formato del idioma (en español, el punto de
  // miles a partir de cinco cifras: «1234», «12.345»).
  it("los recuentos van con el separador de miles del idioma", () => {
    const many = Array.from({ length: 12345 }, (_, i) => entry(i + 1, "pending"));
    render(<LibraryClient entries={many} />);
    expect(statusCount("pending")).toBe("12.345");
  });
});

describe("Biblioteca — el álbum", () => {
  beforeEach(() => {
    current = new URLSearchParams();
  });

  it("una página por estado: en curso, pendientes, completados y abandonados, en ese orden", () => {
    render(<LibraryClient entries={[...ENTRIES, entry(7, "abandoned")]} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings.map((h) => h?.replace(/\d+$/, ""))).toEqual([
      "status.in_progress",
      "status.pending",
      "status.completed",
      "status.abandoned",
    ]);
  });

  it("pendiente = hueco numerado con el título impreso (sin portada), por orden de alta", () => {
    const { container } = render(<LibraryClient entries={ENTRIES} />);
    const page = container.querySelector("#album-pending")!;
    const slots = page.querySelectorAll("[data-slot]");
    expect(slots).toHaveLength(2);
    expect(slots[0]).toHaveTextContent("1");
    expect(slots[0]).toHaveTextContent("Título 5");
    expect(slots[1]).toHaveTextContent("2");
    expect(page.querySelector("[data-cromo]")).toBeNull();
    // El lector oye «Hueco 1, te falta:» antes del título.
    expect(within(page as HTMLElement).getByText('slotPending:{"number":1}')).toHaveClass("sr-only");
  });

  it("en curso = cromo puesto con la tira de progreso y su texto; completado = pegado; abandonado = doblado", () => {
    const { container } = render(
      <LibraryClient
        entries={[
          entry(1, "in_progress", { mediaId: "tv_1", progress: { season: 1, episode: 4, total: 10 } }),
          entry(2, "completed", { rating10: 8 }),
          entry(3, "abandoned"),
        ]}
      />
    );
    const placed = container.querySelector("#album-in_progress [data-cromo]")!;
    expect(placed).toHaveAttribute("data-state", "placed");
    expect(placed.querySelector("[data-progress-strip]")).not.toBeNull();
    expect(container.querySelector("#album-in_progress [data-status]")).toHaveTextContent("label.tvOf");
    expect(container.querySelector("#album-completed [data-cromo]")).toHaveAttribute("data-state", "pasted");
    expect(container.querySelector("#album-abandoned [data-cromo]")).toHaveAttribute("data-state", "folded");
    // Tu nota en el cromo pegado, con nombre para el lector (8/10 = 4 de 5).
    expect(screen.getByText('yourRatingOf:{"value":"4","max":5}')).toHaveClass("sr-only");
  });

  it("solo un 10/10 lleva brillo", () => {
    const { container } = render(
      <LibraryClient entries={[entry(1, "completed", { rating10: 10 }), entry(2, "completed", { rating10: 9 })]} />
    );
    expect(container.querySelectorAll(".cromo-foil")).toHaveLength(1);
  });

  it("cada página enseña 24 huecos y «Ver más» abre los siguientes (WIG: nada de pintar todo de golpe)", () => {
    const many = Array.from({ length: ALBUM_PAGE_SIZE + 5 }, (_, i) => entry(i + 1, "completed"));
    const { container } = render(<LibraryClient entries={many} />);
    expect(container.querySelectorAll("[data-album-item]")).toHaveLength(ALBUM_PAGE_SIZE);
    fireEvent.click(screen.getByRole("button", { name: /^album\.more/ }));
    expect(container.querySelectorAll("[data-album-item]")).toHaveLength(ALBUM_PAGE_SIZE + 5);
  });

  it("las pestañas de formato van fijas y solo con los formatos que tienes", () => {
    render(<LibraryClient entries={[entry(1, "pending"), entry(2, "pending", { mediaId: "book_OL1W" })]} />);
    const tabs = screen.getByRole("group", { name: "type" });
    expect(tabs.parentElement!.className).toContain("sticky");
    expect(within(tabs).getAllByRole("button").map((b) => b.textContent)).toEqual(["all2", "format.movie1", "format.book1"]);
    fireEvent.click(within(tabs).getByText("format.book"));
    expect(mockPush).toHaveBeenCalledWith("/library?type=book");
  });
});

describe("Biblioteca — la lista", () => {
  beforeEach(() => {
    current = new URLSearchParams("view=list");
  });

  it("busca por título sin acentos ni mayúsculas", () => {
    render(
      <LibraryClient entries={[entry(1, "pending", { title: "Amélie" }), entry(2, "pending", { title: "Dune" })]} />
    );
    fireEvent.change(screen.getByLabelText("list.search"), { target: { value: "ameli" } });
    const rows = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-list-row"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Amélie");
  });

  it("ordena por título con el orden del idioma y el orden va en la URL", () => {
    current = new URLSearchParams("view=list&sort=title");
    render(<LibraryClient entries={[entry(1, "pending", { title: "Zelda" }), entry(2, "pending", { title: "Ánima" })]} />);
    const rows = screen.getAllByRole("listitem").filter((li) => li.hasAttribute("data-list-row"));
    expect(rows.map((r) => r.querySelector("a")!.textContent)).toEqual(["Ánima", "Zelda"]);
    fireEvent.change(screen.getByLabelText("list.sort"), { target: { value: "rating" } });
    expect(mockPush).toHaveBeenCalledWith("/library?view=list&sort=rating");
  });
});
