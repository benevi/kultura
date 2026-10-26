// ============================================================
// KULTURA — Caracterización de la pantalla Descubrir (F-32)
//
// Foto fija del HTML que pinta `DiscoverClient` en cada estado (cargando,
// resultados, aleatorio, vacío con y sin filtros, búsqueda, error, agregado)
// y de las navegaciones que dispara. Se escribió ANTES de partir el
// componente en hooks y subcomponentes: el HTML y las URLs no cambian.
// ============================================================

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

vi.mock("next-intl", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key;
  t.has = (key: string) => !key.includes("platform");
  return { useTranslations: (ns: string) => Object.assign((k: string, v?: Record<string, unknown>) => `${ns}.${t(k, v)}`, { has: t.has }), useLocale: () => "es" };
});

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

let current = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => current }));

vi.mock("@/components/media/MediaGrid", () => ({
  MediaGrid: ({ items, showType, layout }: { items: { id: string }[]; showType?: boolean; layout?: string }) => (
    <ul data-testid="media-grid" data-show-type={String(Boolean(showType))} data-layout={layout}>
      {items.map((i) => (
        <li key={i.id}>{i.id}</li>
      ))}
    </ul>
  ),
  BENTO_CELL_CLASSES: ["cell-a", "cell-b", "cell-c"],
}));
vi.mock("@/components/ui/Pagination", () => ({
  Pagination: ({ currentPage, hasMore, totalPages, onPageChange }: { currentPage: number; hasMore: boolean; totalPages: number | null; onPageChange: (p: number) => void }) => (
    <button data-testid="pagination" data-page={currentPage} data-more={String(hasMore)} data-total={String(totalPages)} onClick={() => onPageChange(currentPage + 1)} />
  ),
}));
vi.mock("@/components/search/SearchBar", () => ({
  SearchBar: ({ defaultValue, type, onSubmit, onClear }: { defaultValue?: string; type?: string; onSubmit?: (q: string) => void; onClear?: () => void }) => (
    <input
      data-testid="searchbar"
      data-type={type}
      defaultValue={defaultValue}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit?.((e.target as HTMLInputElement).value);
        if (e.key === "Escape") onClear?.();
      }}
    />
  ),
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

import { DiscoverClient } from "@/app/[locale]/(app)/discover/DiscoverClient";

const ITEMS = [{ id: "movie_1" }, { id: "movie_2" }, { id: "movie_3" }];

function stubFetch(body: unknown, ok = true) {
  const fn = vi.fn(() =>
    ok ? Promise.resolve({ json: async () => body }) : Promise.reject(new Error("red"))
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

async function settle() {
  await waitFor(() => expect(document.querySelector(".animate-pulse")).toBeNull());
}

describe("Descubrir: HTML y navegación (caracterización)", () => {
  beforeEach(() => {
    push.mockClear();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("cargando (antes de que responda la red)", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    current = new URLSearchParams("type=movie&page=1");
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("resultados con filtros, paginación y URL del fetch", async () => {
    const fetchFn = stubFetch({ items: ITEMS, totalPages: null, hasMore: true, fetchErrorKind: null });
    current = new URLSearchParams("type=game&page=2&genre=action,rpg&rating=80&gamemode=coop&sort=rating&nope=1");
    const { container } = render(<DiscoverClient currentType="game" currentPage={2} />);
    await settle();
    expect(fetchFn.mock.calls.map((c) => (c as unknown[])[0])).toMatchSnapshot("fetch");
    expect(container.innerHTML).toMatchSnapshot("html");
    fireEvent.click(screen.getByTestId("pagination"));
    expect(push.mock.calls).toMatchSnapshot("push");
  });

  it("aleatorio: elegir, repetir y cerrar", async () => {
    stubFetch({ items: ITEMS, totalPages: 4, hasMore: true, fetchErrorKind: null });
    current = new URLSearchParams("type=movie&page=1");
    const { container } = render(<DiscoverClient currentType="movie" currentPage={1} />);
    await settle();
    fireEvent.click(screen.getByLabelText("search.randomize"));
    expect(container.innerHTML).toMatchSnapshot("elegido");
    fireEvent.click(screen.getByText("search.randomizeAgain"));
    fireEvent.click(screen.getAllByLabelText("filters.reset").at(-1)!);
    expect(container.innerHTML).toMatchSnapshot("cerrado");
  });

  it("vacío con filtros → limpiar", async () => {
    stubFetch({ items: [], totalPages: 1, hasMore: false, fetchErrorKind: null });
    current = new URLSearchParams("type=tv&page=3&genre=comedy&seasons=3plus");
    const { container } = render(<DiscoverClient currentType="tv" currentPage={3} />);
    await settle();
    expect(container.innerHTML).toMatchSnapshot("html");
    fireEvent.click(screen.getByText("filters.reset"));
    expect(push.mock.calls).toMatchSnapshot("push");
  });

  it("vacío sin filtros, tipo desconocido cae a cine", async () => {
    const fetchFn = stubFetch({ items: [], fetchErrorKind: null });
    current = new URLSearchParams("type=nope&page=1");
    const { container } = render(<DiscoverClient currentType="nope" currentPage={1} />);
    await settle();
    expect(fetchFn.mock.calls.map((c) => (c as unknown[])[0])).toMatchSnapshot("fetch");
    expect(container.innerHTML).toMatchSnapshot("html");
  });

  it("búsqueda: chip, sin filtros, vacío y navegación", async () => {
    const fetchFn = stubFetch({ items: [], totalPages: 1, hasMore: false, fetchErrorKind: null });
    current = new URLSearchParams("type=book&page=1&q=dune&genre=fantasy");
    const { container } = render(<DiscoverClient currentType="book" currentPage={1} currentQuery="  dune " />);
    await settle();
    expect(fetchFn.mock.calls.map((c) => (c as unknown[])[0])).toMatchSnapshot("fetch");
    expect(container.innerHTML).toMatchSnapshot("html");
    fireEvent.click(screen.getByText("filters.tv"));
    fireEvent.keyDown(screen.getByTestId("searchbar"), { key: "Enter", target: { value: "arrakis" } });
    fireEvent.click(screen.getAllByLabelText("filters.reset")[0]);
    expect(push.mock.calls).toMatchSnapshot("push");
  });

  it("error de límite y error de red", async () => {
    stubFetch({ items: [], totalPages: 1, hasMore: false, fetchErrorKind: "rate-limit" });
    current = new URLSearchParams("type=anime&page=1");
    const first = render(<DiscoverClient currentType="anime" currentPage={1} />);
    await settle();
    expect(first.container.innerHTML).toMatchSnapshot("rate-limit");
    first.unmount();

    stubFetch(null, false);
    const second = render(<DiscoverClient currentType="anime" currentPage={2} />);
    await settle();
    expect(second.container.innerHTML).toMatchSnapshot("red");
  });

  it("agregado: grid con tipo y cambio de filtro", async () => {
    stubFetch({ items: ITEMS, totalPages: 9, hasMore: false, fetchErrorKind: null });
    current = new URLSearchParams("type=all&page=2&sort=rating");
    const { container } = render(<DiscoverClient currentType="all" currentPage={2} />);
    await settle();
    expect(container.innerHTML).toMatchSnapshot("html");
    fireEvent.click(screen.getByText("filters.movie"));
    expect(push.mock.calls).toMatchSnapshot("push");
  });

  it("una respuesta tardía de una petición anterior no pisa la actual", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const fn = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockImplementation(() =>
        Promise.resolve({ json: async () => ({ items: [{ id: "tv_9" }], totalPages: 1, hasMore: false, fetchErrorKind: null }) })
      );
    vi.stubGlobal("fetch", fn);
    current = new URLSearchParams("type=movie&page=1");
    const view = render(<DiscoverClient currentType="movie" currentPage={1} />);
    current = new URLSearchParams("type=tv&page=1");
    view.rerender(<DiscoverClient currentType="tv" currentPage={1} />);
    await settle();
    await act(async () => {
      resolveFirst({ json: async () => ({ items: ITEMS, totalPages: 1, hasMore: false, fetchErrorKind: null }) });
    });
    expect(screen.getByTestId("media-grid").textContent).toBe("tv_9");
  });
});
