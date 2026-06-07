import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// useTranslations: (key) => key. Vale tanto para "discover" como "filters".
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockRouterPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// useSearchParams controlable por test: reescribimos `current` en beforeEach.
let current = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => current,
}));

// MediaGrid / Pagination: stubs ligeros para aislar la lógica de DiscoverClient.
vi.mock("@/components/media/MediaGrid", () => ({
  MediaGrid: ({ items }: { items: unknown[] }) => (
    <div data-testid="media-grid">{items.length}</div>
  ),
}));
vi.mock("@/components/ui/Pagination", () => ({
  Pagination: () => <div data-testid="pagination" />,
}));

// Radix Popover (usado por FilterBar multi/menu) toca APIs que jsdom no trae.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture)
    Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture)
    Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture)
    Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {};
});

import { DiscoverClient } from "@/app/[locale]/(app)/discover/DiscoverClient";

// ---------------------------------------------------------------------------
// fetch helper
// ---------------------------------------------------------------------------

function mockFetchOk(items: unknown[] = [], totalPages = 1) {
  const fn = vi.fn().mockResolvedValue({
    json: async () => ({ items, totalPages, fetchErrorKind: null }),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Última URL pasada a fetch como URLSearchParams parseados. */
function lastFetchParams(fetchFn: ReturnType<typeof vi.fn>): URLSearchParams {
  const url = fetchFn.mock.calls.at(-1)?.[0] as string;
  return new URLSearchParams(url.split("?")[1] ?? "");
}

describe("DiscoverClient — E59 F5e", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    current = new URLSearchParams("type=movie&page=1");
  });

  it("cambiar tipo en el SegmentedControl hace push con type nuevo y resetea resto de params", async () => {
    mockFetchOk();
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    // El label del segmento "tv" = clave i18n "tv" (mock = identidad).
    fireEvent.click(screen.getByText("tv"));

    expect(mockRouterPush).toHaveBeenCalledWith("/discover?type=tv&page=1");
  });

  it("seleccionar un género (multi) escribe genre=CSV en la URL con page=1", async () => {
    const fetchFn = mockFetchOk();
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    // Abrir el popover del trigger "genre" (label humanizada = "Genre").
    // El <p> del grupo y el botón trigger comparten texto → seleccionar el botón.
    fireEvent.click(screen.getByRole("button", { name: "Genre" }));
    // Marcar la primera opción de género disponible.
    const checkbox = (await screen.findAllByRole("checkbox"))[0];
    fireEvent.click(checkbox);

    const url = mockRouterPush.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("genre")).toBeTruthy();
    expect(params.get("page")).toBe("1");
    expect(params.get("type")).toBe("movie");

    // El fetch del primer render envía type+page (sin filtros aún).
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
  });

  it("seleccionar un bucket de año escribe year en la URL (sin filtrado client-side)", async () => {
    mockFetchOk([{ id: "a" }, { id: "b" }], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    const thisYear = String(new Date().getFullYear());
    // year es kind 'single' → chips inline; click directo en el chip del año.
    fireEvent.click(screen.getByText(thisYear));

    const url = mockRouterPush.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("year")).toBe(thisYear);
    expect(params.get("page")).toBe("1");

    // Grid muestra TODOS los items recibidos: no se filtra en cliente por año.
    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveTextContent("2")
    );
  });

  it("el fetch reenvía todos los params de filtro presentes en la URL", async () => {
    const fetchFn = mockFetchOk();
    current = new URLSearchParams(
      "type=movie&page=2&genre=28,12&year=2024&sort=popularity"
    );
    render(<DiscoverClient currentType="movie" currentPage={2} />);

    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    const params = lastFetchParams(fetchFn);
    expect(params.get("type")).toBe("movie");
    expect(params.get("page")).toBe("2");
    expect(params.get("genre")).toBe("28,12");
    expect(params.get("year")).toBe("2024");
    expect(params.get("sort")).toBe("popularity");
  });

  it("seleccionar sort (menu) escribe sort en la URL", async () => {
    mockFetchOk();
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    // Trigger del menú sort (label humanizada = "Sort").
    fireEvent.click(screen.getByRole("button", { name: "Sort" }));
    // Primera opción del menú de sort.
    const option = (await screen.findAllByRole("button")).find((b) =>
      b.className.includes("text-left")
    );
    expect(option).toBeTruthy();
    fireEvent.click(option!);

    const url = mockRouterPush.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("sort")).toBeTruthy();
    expect(params.get("page")).toBe("1");
  });

  it("activeFilters refleja la URL: multi → array, single → string", async () => {
    mockFetchOk();
    current = new URLSearchParams("type=movie&page=1&genre=28,12");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    // El badge de count del trigger multi genre muestra 2 selecciones.
    const badge = await screen.findByTestId("badge-genre");
    expect(badge).toHaveTextContent("2");
  });

  // ── F5f: grid + estado vacío + clear filters ────────────────────────────

  it("0 resultados CON filtros activos → estado vacío con botón limpiar", async () => {
    mockFetchOk([], 1);
    current = new URLSearchParams("type=movie&page=1&genre=28");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    // No hay grid de resultados.
    await waitFor(() =>
      expect(screen.queryByTestId("media-grid")).not.toBeInTheDocument()
    );
    // Mensaje de vacío (clave noResults) + botón limpiar (clave reset).
    expect(screen.getByText("noResults")).toBeInTheDocument();
    expect(screen.getByText("reset")).toBeInTheDocument();
  });

  it("0 resultados SIN filtros → estado vacío sin botón limpiar", async () => {
    mockFetchOk([], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    await waitFor(() =>
      expect(screen.queryByTestId("media-grid")).not.toBeInTheDocument()
    );
    expect(screen.getByText("noResults")).toBeInTheDocument();
    // Sin filtros activos no hay nada que limpiar → sin botón.
    expect(screen.queryByText("reset")).not.toBeInTheDocument();
  });

  it("click 'Limpiar filtros' deja la URL solo con type+page=1", async () => {
    mockFetchOk([], 1);
    current = new URLSearchParams("type=movie&page=3&genre=28&year=2024");
    render(<DiscoverClient currentType="movie" currentPage={3} />);

    fireEvent.click(await screen.findByText("reset"));

    const url = mockRouterPush.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("type")).toBe("movie");
    expect(params.get("page")).toBe("1");
    expect(params.get("genre")).toBeNull();
    expect(params.get("year")).toBeNull();
  });

  it("grid renderiza N cards cuando hay resultados", async () => {
    mockFetchOk([{ id: "a" }, { id: "b" }, { id: "c" }], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveTextContent("3")
    );
  });
});
