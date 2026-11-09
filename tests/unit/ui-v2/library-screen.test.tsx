import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { LibraryEntryWithProgress } from "@/lib/library/progress";
import type { DiaryLog, LibraryStatus } from "@/types/library";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vals?: { count?: number }) => (vals?.count !== undefined ? `${key}:${vals.count}` : key),
  useLocale: () => "es",
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/ToastProvider", () => ({
  useToastContext: () => ({ show: h.show, showError: h.showError }),
}));
vi.mock("@/lib/library/actions", () => ({ deleteDiaryLog: (id: string) => h.remove(id) }));

const h = vi.hoisted(() => ({
  params: new URLSearchParams(),
  show: vi.fn(),
  showError: vi.fn(),
  remove: vi.fn(async (_id: string) => undefined),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/es/library",
  useSearchParams: () => h.params,
}));

import { LibraryScreen } from "@/v2/library/LibraryScreen";

function entry(id: string, status: LibraryStatus, over: Partial<LibraryEntryWithProgress> = {}): LibraryEntryWithProgress {
  return {
    id,
    userId: "u",
    mediaId: id,
    status,
    score: null,
    watchedAt: null,
    episodeProgress: null,
    progress: null,
    createdAt: "2026-01-01",
    title: `Obra ${id}`,
    ...over,
  };
}

const ENTRIES = [
  entry("movie_1", "completed", { score: 5, favorite: true }),
  entry("movie_2", "completed", { score: 3 }),
  entry("game_3", "abandoned"),
  entry("manga_4", "in_progress", { progress: { chapter: 30, total: 120 } }),
  entry("manga_5", "pending"),
];

const log = (over: Partial<DiaryLog>): DiaryLog => ({
  id: "l1",
  mediaId: "movie_1",
  watchedOn: "2026-10-05",
  rewatch: false,
  rating10: null,
  review: null,
  spoiler: false,
  privateNote: null,
  createdAt: "2026-10-05",
  title: "Obra",
  ...over,
});

const titles = () => screen.queryAllByRole("heading", { level: 2 }).map((e) => e.textContent);
const rail = (name: string) => screen.getByRole("group", { name });

let push: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.params = new URLSearchParams();
  h.remove.mockClear();
  h.show.mockClear();
  h.showError.mockClear();
  push = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
});
afterEach(() => push.mockRestore());

describe("Biblioteca v2: raíl", () => {
  it("cuenta la biblioteca entera aunque haya un filtro activo", () => {
    h.params = new URLSearchParams("status=pending");
    render(<LibraryScreen entries={ENTRIES} />);
    const status = within(rail("status"));
    expect(status.getByRole("button", { name: /counters\.completed/ }).textContent).toContain("2");
    expect(status.getByRole("button", { name: /^all/ }).textContent).toContain("5");
    expect(titles()).toEqual(["Obra manga_5"]);
  });

  it("solo lista los formatos que hay, salvo el que está filtrado", () => {
    h.params = new URLSearchParams("type=book");
    render(<LibraryScreen entries={ENTRIES} />);
    const type = within(rail("type"));
    expect(type.getAllByRole("button").map((b) => b.textContent)).toEqual(["movie2", "book0", "manga2", "game1"]);
  });

  it("el filtro cambia la URL sin ir al servidor, y pulsarlo otra vez lo quita", () => {
    h.params = new URLSearchParams("status=abandoned");
    render(<LibraryScreen entries={ENTRIES} />);
    fireEvent.click(within(rail("type")).getByRole("button", { name: /game/ }));
    expect(push).toHaveBeenLastCalledWith(null, "", "/es/library?type=game&status=abandoned");
    fireEvent.click(within(rail("status")).getByRole("button", { name: /counters\.dropped/ }));
    expect(push).toHaveBeenLastCalledWith(null, "", "/es/library");
  });

  it("lee los parámetros de la pantalla vieja: un enlace guardado sigue valiendo", () => {
    h.params = new URLSearchParams("type=movie&score=4");
    render(<LibraryScreen entries={ENTRIES} />);
    expect(titles()).toEqual(["Obra movie_1"]);
    expect(within(rail("type")).getByRole("button", { name: /movie/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("sin notas no ofrece filtrar por nota", () => {
    render(<LibraryScreen entries={[entry("manga_4", "pending")]} />);
    expect(screen.queryByRole("group", { name: /minScore/ })).toBeNull();
  });

  it("sin diario no hay vistas ni favoritos, e ignora fav y view de la URL", () => {
    h.params = new URLSearchParams("fav=1&view=diary");
    render(<LibraryScreen entries={ENTRIES} />);
    expect(screen.queryByRole("group", { name: "view" })).toBeNull();
    expect(screen.queryByRole("button", { name: "favorites" })).toBeNull();
    expect(titles()).toHaveLength(5);
  });

  it("con diario, favoritos filtra", () => {
    h.params = new URLSearchParams("fav=1");
    render(<LibraryScreen entries={ENTRIES} diary={{ logs: [], scale: "stars" }} />);
    expect(titles()).toEqual(["Obra movie_1"]);
  });
});

describe("Biblioteca v2: navegación", () => {
  it("pulsar lo que ya está activo no apila otra entrada en el historial", () => {
    window.history.replaceState(null, "", "/es/library");
    render(<LibraryScreen entries={ENTRIES} />);
    fireEvent.click(within(rail("status")).getByRole("button", { name: /^all/ }));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(within(rail("status")).getByRole("button", { name: /counters.pending/ }));
    expect(push).toHaveBeenCalledTimes(1);
    window.history.replaceState(null, "", "/");
  });

  it("al quitar los filtros, el foco pasa al título en vez de perderse", () => {
    h.params = new URLSearchParams("type=game&status=pending");
    render(<LibraryScreen entries={ENTRIES} />);
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("puntuación y favoritos se pliegan, y arrancan abiertos si ya filtran", () => {
    const { unmount } = render(<LibraryScreen entries={ENTRIES} />);
    const more = screen.getByRole("button", { name: "filters" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("k2b-extra")?.dataset.open).toBe("true");
    unmount();
    h.params = new URLSearchParams("score=4");
    render(<LibraryScreen entries={ENTRIES} />);
    expect(screen.getByRole("button", { name: "filters" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("sin notas ni diario no hay nada que plegar", () => {
    render(<LibraryScreen entries={[entry("manga_4", "pending")]} />);
    expect(screen.queryByRole("button", { name: "filters" })).toBeNull();
  });
});

describe("Biblioteca v2: pared", () => {
  it("cada obra enlaza a su ficha y dice su estado a quien no ve la portada", () => {
    render(<LibraryScreen entries={ENTRIES} />);
    const link = screen.getByRole("link", { name: /Obra game_3/ });
    expect(link.getAttribute("href")).toBe("/media/game/3");
    expect(link.textContent).toContain("status.abandoned");
  });

  it("la barra sale con el progreso de la columna, solo en curso y con total", () => {
    const { container } = render(
      <LibraryScreen
        entries={[
          entry("manga_4", "in_progress", { progress: { chapter: 30, total: 120 }, episodeProgress: null }),
          entry("manga_6", "in_progress", { progress: { chapter: 30 } }),
          entry("manga_7", "completed", { progress: { chapter: 120, total: 120 } }),
        ]}
      />
    );
    const bars = container.querySelectorAll<HTMLElement>(".k2b-work__bar span");
    expect(bars).toHaveLength(1);
    expect(bars[0].style.width).toBe("25%");
  });

  it("sin portada, la reserva lleva el título", () => {
    const { container } = render(<LibraryScreen entries={[entry("movie_1", "pending")]} />);
    expect(container.querySelector(".k2b-cover--plain")?.textContent).toBe("Obra movie_1");
  });

  it("nada encaja: lo dice, enseña cómo salir y el enlace del encabezado no se repite", () => {
    h.params = new URLSearchParams("type=game&status=pending");
    render(<LibraryScreen entries={ENTRIES} />);
    expect(screen.getByRole("heading", { name: "empty.filtered" })).toBeTruthy();
    const reset = screen.getAllByRole("button", { name: "reset" });
    expect(reset).toHaveLength(1);
    fireEvent.click(reset[0]);
    expect(push).toHaveBeenLastCalledWith(null, "", "/es/library");
  });

  it("biblioteca vacía: sin raíl y con el camino a descubrir", () => {
    render(<LibraryScreen entries={[]} />);
    expect(screen.queryByRole("group", { name: "status" })).toBeNull();
    expect(screen.getByRole("link", { name: "empty.cta" }).getAttribute("href")).toBe("/discover");
  });
});

describe("Biblioteca v2: diario", () => {
  const diaryProps = (logs: DiaryLog[]) => ({ entries: ENTRIES, diary: { logs, scale: "stars" as const } });

  it("agrupa por mes y oculta la reseña con spoilers hasta pulsar", () => {
    h.params = new URLSearchParams("view=diary");
    render(
      <LibraryScreen
        {...diaryProps([
          log({ id: "a", watchedOn: "2026-11-02", review: "Secreto", spoiler: true }),
          log({ id: "b", watchedOn: "2026-10-05", review: "Abierta" }),
        ])}
      />
    );
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.queryByText("Secreto")).toBeNull();
    expect(screen.getByText("Abierta")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "showSpoiler" }));
    expect(screen.getByText("Secreto")).toBeTruthy();
  });

  it("borrar quita el apunte y lo anuncia", async () => {
    h.params = new URLSearchParams("view=diary");
    render(<LibraryScreen {...diaryProps([log({ id: "a" })])} />);
    fireEvent.click(screen.getByRole("button", { name: "deleteLog" }));
    expect(h.remove).toHaveBeenCalledWith("a");
    expect(await screen.findByRole("heading", { name: "emptyTitle" })).toBeTruthy();
    expect(h.show).toHaveBeenCalled();
  });

  it("un apunte borrado no vuelve al ir a Títulos y regresar al diario", async () => {
    h.params = new URLSearchParams("view=diary");
    const props = diaryProps([log({ id: "a", title: "Apunte" })]);
    const { rerender } = render(<LibraryScreen {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "deleteLog" }));
    await screen.findByRole("heading", { name: "emptyTitle" });
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    h.params = new URLSearchParams();
    rerender(<LibraryScreen {...props} />);
    h.params = new URLSearchParams("view=diary");
    rerender(<LibraryScreen {...props} />);
    expect(screen.getByRole("heading", { name: "emptyTitle" })).toBeTruthy();
  });

  it("si borrar falla, el apunte se queda y se avisa", async () => {
    h.params = new URLSearchParams("view=diary");
    h.remove.mockRejectedValueOnce(new Error("no"));
    render(<LibraryScreen {...diaryProps([log({ id: "a" })])} />);
    fireEvent.click(screen.getByRole("button", { name: "deleteLog" }));
    await vi.waitFor(() => expect(h.showError).toHaveBeenCalledWith("deleteFailed"));
    expect(screen.getByRole("button", { name: "deleteLog" })).toBeTruthy();
  });
});
