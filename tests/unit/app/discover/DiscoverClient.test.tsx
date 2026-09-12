import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// useTranslations: (key) => key. Vale tanto para "discover" como "filters".
// R6: el translator expone .has() (API next-intl v4) que DiscoverClient usa
// para decidir lookup i18n vs fallback humanizeSlug. En test .has()→true
// (namespace poblado) → el label es la propia clave, suficiente para estos
// asserts (verifican estructura, no el texto traducido).
vi.mock("next-intl", () => {
  const t = (key: string) => key;
  t.has = () => true;
  return { useTranslations: () => t };
});

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
  MediaGrid: ({ items, showType }: { items: unknown[]; showType?: boolean }) => (
    <div data-testid="media-grid" data-show-type={String(Boolean(showType))}>
      {items.length}
    </div>
  ),
  // F3b: DiscoverClient importa este patrón para el skeleton de carga bento.
  BENTO_CELL_CLASSES: ["col-span-1"],
}));
vi.mock("@/components/ui/Pagination", () => ({
  Pagination: () => <div data-testid="pagination" />,
}));

// E-DISCOVER-SEARCH-MERGE: SearchBar real hace su propio fetch de autocompletado
// (/api/search) — stub ligero que solo expone un input controlado y dispara
// onSubmit/onClear, igual que MediaGrid/Pagination arriba aíslan su lógica.
vi.mock("@/components/search/SearchBar", () => ({
  SearchBar: ({
    defaultValue,
    onSubmit,
    onClear,
  }: {
    defaultValue?: string;
    onSubmit?: (q: string) => void;
    onClear?: () => void;
  }) => (
    <input
      type="search"
      data-testid="discover-searchbar"
      defaultValue={defaultValue}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit?.((e.target as HTMLInputElement).value);
      }}
      onChange={(e) => {
        if (e.target.value.trim() === "") onClear?.();
      }}
    />
  ),
}));

// Radix Popover (FilterBar v3 = TODO popover, incl. single) toca APIs jsdom no trae.
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

    // Abrir el popover del trigger "genre". R6: el label es i18n (clave en el
    // mock); seleccionamos por testid estable, no por texto del label.
    fireEvent.click(screen.getByTestId("filter-trigger-genre"));
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
    // year es kind 'single' → v3 popover; abrir trigger por testid y clicar
    // opción. El bucket de año tiene label literal (no i18n) = el año.
    fireEvent.click(screen.getByTestId("filter-trigger-year"));
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

  it("seleccionar sort (variant 'Ordenar: <valor>') escribe sort en la URL", async () => {
    mockFetchOk();
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    // R3: el trigger de sort se renderiza como "<sortLabel>: <valor>" (mock
    // i18n: sortLabel = "sort"). Su nombre accesible contiene "sort:".
    fireEvent.click(screen.getByRole("button", { name: /sort:/i }));
    // Primera opción del popover de sort (role=radio, text-left).
    const option = (await screen.findAllByRole("radio")).find((b) =>
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

  // ── R5b: tipo agregado "all" (modo Descubrir todos, grid mezclada) ──────────

  it("type='all' llama a /api/discover?type=all y pinta la grid (sin 'Próximamente')", async () => {
    const fetchFn = mockFetchOk([{ id: "a" }, { id: "b" }], 1);
    current = new URLSearchParams("type=all&page=1");
    render(<DiscoverClient currentType="all" currentPage={1} />);

    // Ahora SÍ hace fetch a /api/discover con type=all.
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(lastFetchParams(fetchFn).get("type")).toBe("all");

    // Grid normal con los items del merge; sin estado "Próximamente".
    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveTextContent("2")
    );
    expect(screen.queryByText("comingSoon")).not.toBeInTheDocument();
  });

  it("type='all' pasa showType=true a la grid (badge de tipo por card)", async () => {
    mockFetchOk([{ id: "a" }], 1);
    current = new URLSearchParams("type=all&page=1");
    render(<DiscoverClient currentType="all" currentPage={1} />);

    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveAttribute(
        "data-show-type",
        "true"
      )
    );
  });

  it("type concreto (movie) pasa showType=false (badge redundante)", async () => {
    mockFetchOk([{ id: "a" }], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveAttribute(
        "data-show-type",
        "false"
      )
    );
  });

  it("type='all' sigue renderizando la barra de tipos (incluye 'all')", () => {
    mockFetchOk();
    current = new URLSearchParams("type=all&page=1");
    render(<DiscoverClient currentType="all" currentPage={1} />);
    // La fila TIPO ofrece el tipo "all" (label i18n = "all").
    expect(screen.getByText("all")).toBeInTheDocument();
  });

  // ── R3: barra de 2 filas etiquetadas (TIPO / FILTROS) ───────────────────────

  it("la barra muestra las etiquetas de fila TIPO y FILTROS", () => {
    mockFetchOk();
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);
    // mock i18n = identidad: "type" (TIPO) y "filters" (FILTROS).
    expect(screen.getByText("type")).toBeInTheDocument();
    expect(screen.getByText("filters")).toBeInTheDocument();
  });

  it("la fila TIPO es un radiogroup con pills (radio) por tipo", () => {
    mockFetchOk();
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();
    // La pill activa (movie) tiene aria-checked.
    const movie = screen.getByRole("radio", { name: "movie" });
    expect(movie).toHaveAttribute("aria-checked", "true");
  });

  it("el trigger sort se empuja a la derecha (ml-auto)", () => {
    mockFetchOk();
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);
    expect(screen.getByRole("button", { name: /sort:/i })).toHaveClass("ml-auto");
  });

  // ── E-DISCOVER-SEARCH-MERGE: buscador de texto dentro de Discover ───────────

  it("renderiza el SearchBar dentro de Discover", () => {
    mockFetchOk();
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);
    expect(screen.getByTestId("discover-searchbar")).toBeInTheDocument();
  });

  it("buscar escribe q en la URL con page=1, conservando el type activo", async () => {
    mockFetchOk();
    current = new URLSearchParams("type=tv&page=3");
    render(<DiscoverClient currentType="tv" currentPage={3} />);

    fireEvent.change(screen.getByTestId("discover-searchbar"), {
      target: { value: "dune" },
    });
    fireEvent.keyDown(screen.getByTestId("discover-searchbar"), { key: "Enter" });

    expect(mockRouterPush).toHaveBeenCalledWith("/discover?type=tv&page=1&q=dune");
  });

  it("con q activa (currentQuery), el fetch a /api/discover incluye q y se oculta la barra de filtros", async () => {
    const fetchFn = mockFetchOk([{ id: "a" }], 1);
    current = new URLSearchParams("type=movie&page=1&q=dune");
    render(<DiscoverClient currentType="movie" currentPage={1} currentQuery="dune" />);

    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(lastFetchParams(fetchFn).get("q")).toBe("dune");
    // FilterBar (fila FILTROS) no se renderiza en modo búsqueda.
    expect(screen.queryByText("filters")).not.toBeInTheDocument();
    // Chip con la query activa.
    expect(screen.getByText("dune")).toBeInTheDocument();
  });

  it("limpiar la búsqueda (chip X) navega a /discover?type=X&page=1 sin q", async () => {
    mockFetchOk([{ id: "a" }], 1);
    current = new URLSearchParams("type=movie&page=1&q=dune");
    render(<DiscoverClient currentType="movie" currentPage={1} currentQuery="dune" />);

    fireEvent.click(await screen.findByLabelText("reset"));
    expect(mockRouterPush).toHaveBeenCalledWith("/discover?type=movie&page=1");
  });

  it("cambiar de tipo con búsqueda activa conserva la query", () => {
    mockFetchOk();
    current = new URLSearchParams("type=movie&page=1&q=dune");
    render(<DiscoverClient currentType="movie" currentPage={1} currentQuery="dune" />);

    fireEvent.click(screen.getByText("tv"));
    expect(mockRouterPush).toHaveBeenCalledWith("/discover?type=tv&page=1&q=dune");
  });

  it("sin filtros ni búsqueda, sin resultados: no aparece la barra de filtros pero sí el catálogo vacío estándar", async () => {
    mockFetchOk([], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);
    await waitFor(() => expect(screen.getByText("noResults")).toBeInTheDocument());
    // Sin búsqueda activa: la barra de filtros SÍ se muestra.
    expect(screen.getByText("filters")).toBeInTheDocument();
  });

  // ── E-RANDOMIZE-ALWAYS: "Sorpréndeme" siempre presente ──────────────────────

  it("el botón Sorpréndeme está presente y deshabilitado con 0 resultados (nunca oculto)", async () => {
    mockFetchOk([], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    const btn = await screen.findByRole("button", { name: "randomize" });
    await waitFor(() => expect(btn).toBeDisabled());
  });

  it("con resultados, Sorpréndeme está habilitado y al pulsarlo muestra un único item con banner", async () => {
    mockFetchOk([{ id: "a" }, { id: "b" }, { id: "c" }], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    const btn = await screen.findByRole("button", { name: "randomize" });
    await waitFor(() => expect(btn).toBeEnabled());

    fireEvent.click(btn);

    // El grid pasa a mostrar solo 1 item (el aleatorio elegido).
    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveTextContent("1")
    );
    expect(screen.getByText("randomizeAgain")).toBeInTheDocument();
  });

  it("quitar el aleatorio (X del banner) vuelve a mostrar el grid completo", async () => {
    mockFetchOk([{ id: "a" }, { id: "b" }], 1);
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    const btn = await screen.findByRole("button", { name: "randomize" });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveTextContent("1")
    );

    fireEvent.click(screen.getByLabelText("reset"));
    await waitFor(() =>
      expect(screen.getByTestId("media-grid")).toHaveTextContent("2")
    );
  });

  // ── E78: pills de tipo llevan icono propio, no emoji ────────────────────

  it("las pills de tipo llevan un icono propio sin alterar el nombre accesible", () => {
    mockFetchOk();
    current = new URLSearchParams("type=movie&page=1");
    render(<DiscoverClient currentType="movie" currentPage={1} />);

    // El icono es aria-hidden (svg): el nombre accesible del radio sigue
    // siendo exactamente la etiqueta i18n (mock identidad), no el icono.
    const movie = screen.getByRole("radio", { name: "movie" });
    expect(movie.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    expect(movie).not.toHaveTextContent("🎬");
  });
});
