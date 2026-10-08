import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LibraryEntry, LibraryStatus } from "@/types/library";

// useTranslations: (key) => key.
vi.mock("next-intl", () => {
  const t = (key: string) => key;
  t.has = () => true;
  return { useTranslations: () => t };
});

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

let current = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => current,
}));

vi.mock("@/components/media/MediaGrid", () => ({
  MediaGrid: ({ items }: { items: unknown[] }) => <div data-testid="grid">{items.length}</div>,
}));

import { LibraryClient } from "@/app/[locale]/(app)/library/LibraryClient";

function entry(i: number, status: LibraryStatus): LibraryEntry {
  return {
    id: `e${i}`,
    userId: "u",
    mediaId: `movie_${i}`,
    status,
    score: null,
    watchedAt: null,
    episodeProgress: null,
    createdAt: "2026-01-01",
  };
}

const ENTRIES: LibraryEntry[] = [
  entry(1, "completed"),
  entry(2, "completed"),
  entry(3, "completed"),
  entry(4, "in_progress"),
  entry(5, "pending"),
  entry(6, "pending"),
];

function counterValue(label: string): string | null {
  const list = screen.getByRole("list", { name: "title" });
  const item = within(list).getByText(label).closest("li");
  return item?.querySelector("span")?.textContent ?? null;
}

describe("Biblioteca — fila de contadores del artboard", () => {
  beforeEach(() => {
    current = new URLSearchParams();
  });

  it("cuenta cada estado, con cero para los que no hay", () => {
    render(<LibraryClient entries={ENTRIES} />);
    expect(counterValue("counters.completed")).toBe("3");
    expect(counterValue("counters.inProgress")).toBe("1");
    expect(counterValue("counters.pending")).toBe("2");
    expect(counterValue("counters.dropped")).toBe("0");
  });

  // Son el resumen de la biblioteca, no el resultado del filtro: con el filtro
  // de estado puesto, los otros estados no se quedan a cero.
  it("cuenta la biblioteca entera aunque haya un filtro activo", () => {
    current = new URLSearchParams("status=pending");
    render(<LibraryClient entries={ENTRIES} />);
    expect(screen.getByTestId("grid").textContent).toBe("2");
    expect(counterValue("counters.completed")).toBe("3");
  });
});
