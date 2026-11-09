import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { MediaItem } from "@/types/media";

vi.mock("next-intl", () => {
  const t = (key: string, vals?: { count?: number; n?: number }) => {
    if (vals?.count !== undefined) return `${key}:${vals.count}`;
    if (vals?.n !== undefined) return `${key}:${vals.n}`;
    return key;
  };
  t.has = () => true;
  return { useTranslations: () => t, useLocale: () => "es" };
});

const h = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  ui: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/es/discover",
  useSearchParams: () => h.params,
}));
vi.mock("@/i18n/navigation", async () => {
  const { forwardRef } = await import("react");
  return {
    useRouter: () => ({ push: h.push }),
    Link: forwardRef<HTMLAnchorElement, { children: ReactNode; href: string; className?: string }>(function Link(
      { children, href, className },
      ref
    ) {
      return (
        <a ref={ref} href={href} className={className}>
          {children}
        </a>
      );
    }),
  };
});
vi.mock("@/components/search/SearchBar", () => ({
  SearchBar: ({ defaultValue, onSubmit }: { defaultValue?: string; onSubmit?: (q: string) => void }) => (
    <input
      aria-label="campo"
      defaultValue={defaultValue}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit?.(e.currentTarget.value);
      }}
    />
  ),
}));
vi.mock("@/lib/ui-v2", () => ({ isUiV2Enabled: async () => h.ui }));
vi.mock("@/app/[locale]/(app)/discover/DiscoverClient", () => ({ DiscoverClient: () => <div data-testid="v1" /> }));

import { DiscoverScreen } from "@/v2/discover/DiscoverScreen";

const item = (id: number, over: Partial<MediaItem> = {}): MediaItem => ({
  id: `movie_${id}`,
  externalId: String(id),
  type: "movie",
  title: `Obra ${id}`,
  poster: `https://image.tmdb.org/t/p/w500/${id}.jpg`,
  year: 2020,
  ...over,
});

function respond(body: Record<string, unknown>) {
  const fetchMock = vi.fn(async (_url: string) => ({
    json: async () => ({ items: [], hasMore: false, totalPages: 1, fetchErrorKind: null, ...body }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const setUrl = (qs: string) => {
  h.params = new URLSearchParams(qs);
  window.history.replaceState(null, "", qs ? `/es/discover?${qs}` : "/es/discover");
};

const pushed = () => (window.history.pushState as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2]);

async function mount() {
  const view = render(<DiscoverScreen />);
  await waitFor(() => expect(screen.getByRole("status").textContent).not.toBe("loading"));
  return view;
}

beforeEach(() => {
  setUrl("");
  h.push.mockClear();
  vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Descubrir v2: datos y URL", () => {
  it("sin parámetros pide películas, página 1, con el idioma", async () => {
    const fetchMock = respond({ items: [item(1)] });
    await mount();
    expect(fetchMock.mock.calls[0]).toEqual(["/api/discover?type=movie&page=1&locale=es"]);
  });

  it("un tipo o una página inválidos caen a película y página 1", async () => {
    setUrl("type=nada&page=-3");
    const fetchMock = respond({ items: [item(1)] });
    await mount();
    expect(fetchMock.mock.calls[0]).toEqual(["/api/discover?type=movie&page=1&locale=es"]);
    expect(screen.getByRole("radio", { name: "movie" }).getAttribute("aria-checked")).toBe("true");
  });

  it("los filtros de la URL viajan a la API, también los de paramKey distinto", async () => {
    setUrl("type=tv&page=2&genre=drama,crimen&seasons=short");
    const fetchMock = respond({ items: [item(1)] });
    await mount();
    const url = new URL(`http://x${fetchMock.mock.calls[0][0]}`);
    expect(url.searchParams.get("genre")).toBe("drama,crimen");
    expect(url.searchParams.get("seasons")).toBe("short");
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("cambiar de formato escribe la URL sin servidor, quita filtros y conserva la búsqueda", async () => {
    setUrl("type=movie&page=3&genre=drama&q=dune");
    respond({ items: [item(1)] });
    await mount();
    fireEvent.click(screen.getByRole("radio", { name: "tv" }));
    expect(pushed()).toEqual(["/es/discover?type=tv&page=1&q=dune"]);
    expect(h.push).not.toHaveBeenCalled();
  });

  it("pulsar el formato activo no navega ni borra filtros", async () => {
    setUrl("type=movie&page=1&genre=drama");
    respond({ items: [item(1)] });
    await mount();
    fireEvent.click(screen.getByRole("radio", { name: "movie" }));
    expect(pushed()).toEqual([]);
  });

  it("buscar conserva el tipo y vuelve a la página 1", async () => {
    setUrl("type=anime&page=4");
    respond({ items: [item(1)] });
    await mount();
    const field = screen.getByLabelText("campo") as HTMLInputElement;
    field.value = "naruto";
    fireEvent.keyDown(field, { key: "Enter" });
    expect(pushed()).toEqual(["/es/discover?type=anime&page=1&q=naruto"]);
  });
});

describe("Descubrir v2: pared", () => {
  it("no enseña obras sin portada ni las que fallan al cargar", async () => {
    respond({ items: [item(1), item(2, { poster: undefined }), item(3)] });
    await mount();
    expect(screen.getByRole("heading", { name: "Obra 1" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Obra 2" })).toBeNull();
    const img = screen.getByRole("heading", { name: "Obra 3" }).closest("a")?.querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.queryByRole("heading", { name: "Obra 3" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("results:1");
  });

  it("enlaza a la ficha, y el formato de cada obra solo sale en «Todos»", async () => {
    respond({ items: [item(7)] });
    const { unmount } = await mount();
    expect(screen.getByRole("heading", { name: "Obra 7" }).closest("a")?.getAttribute("href")).toBe("/media/movie/7");
    expect(screen.queryByText("movie", { selector: ".k2d-meta__type" })).toBeNull();
    unmount();
    setUrl("type=all");
    respond({ items: [item(7)] });
    await mount();
    expect(screen.getByText("movie", { selector: ".k2d-meta__type" })).toBeTruthy();
  });

  it("la paginación sale fuera de la 1, y «Siguiente» depende de hasMore", async () => {
    setUrl("type=movie&page=2");
    respond({ items: [item(1)], hasMore: false, totalPages: 2 });
    await mount();
    expect((screen.getByTestId("pagination-next") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "pageN:1" }));
    expect(pushed()).toEqual(["/es/discover?type=movie&page=1"]);
  });

  it("sin más páginas no hay paginación", async () => {
    respond({ items: [item(1)], hasMore: false, totalPages: 1 });
    await mount();
    expect(screen.queryByTestId("pagination-next")).toBeNull();
  });

  it("con total no fiable no inventa la última página", async () => {
    setUrl("type=game&page=2&playtime=short");
    respond({ items: [item(1)], hasMore: true, totalPages: null });
    await mount();
    const pages = within(screen.getByRole("navigation")).getAllByRole("button", { name: /pageN/ });
    expect(pages.map((b) => b.textContent)).toEqual(["1", "2", "3"]);
  });
});

describe("Descubrir v2: vacíos y errores", () => {
  it("un error de proveedor no se presenta como «sin resultados» y se puede reintentar", async () => {
    const fetchMock = respond({ fetchErrorKind: "rate-limit" });
    await mount();
    expect(screen.getByRole("alert").textContent).toBe("fetchError.rateLimit");
    expect(screen.queryByText("noResults")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("un fallo de red sale como error genérico", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("red")))
    );
    await mount();
    expect((await screen.findByRole("alert")).textContent).toBe("fetchError.generic");
  });

  it("sin resultados de búsqueda no repite lo escrito y ofrece buscar en todo", async () => {
    setUrl("type=movie&page=1&q=zzzz");
    respond({ items: [] });
    await mount();
    expect((await screen.findByTestId("discover-empty")).textContent).not.toContain("zzzz");
    fireEvent.click(screen.getByRole("button", { name: "searchEverywhere" }));
    expect(pushed()).toEqual(["/es/discover?type=all&page=1&q=zzzz"]);
  });

  it("buscando no hay filtros, y hay un botón para quitar la búsqueda", async () => {
    setUrl("type=movie&page=1&q=dune");
    respond({ items: [item(1)] });
    await mount();
    expect(screen.queryByTestId("filter-trigger-sort")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "clearSearch" }));
    expect(pushed()).toEqual(["/es/discover?type=movie&page=1"]);
  });

  it("sin resultados con filtros, ofrece quitarlos; sin filtros, nada que quitar", async () => {
    setUrl("type=movie&page=1&genre=drama");
    respond({ items: [] });
    const { unmount } = await mount();
    within(await screen.findByTestId("discover-empty")).getByRole("button", { name: "reset" });
    unmount();
    setUrl("type=movie&page=1");
    respond({ items: [] });
    await mount();
    expect(await screen.findByRole("heading", { name: "noResults" })).toBeTruthy();
    expect(screen.queryByTestId("discover-empty")).toBeNull();
  });
});

describe("Descubrir v2: sorpréndeme", () => {
  it("elige una obra con portada, pone el foco en ella y vuelve al botón", async () => {
    respond({ items: [item(1), item(2)] });
    await mount();
    await screen.findByRole("heading", { name: "Obra 1" });
    const dice = screen.getByRole("button", { name: "randomize" });
    fireEvent.click(dice);
    const link = screen.getByRole("link", { name: "open" });
    expect(document.activeElement).toBe(link);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.queryByRole("navigation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "backToList" }));
    expect(document.activeElement).toBe(dice);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });

  it("«Otra vez» no repite la misma si hay más", async () => {
    respond({ items: [item(1), item(2)] });
    await mount();
    await screen.findByRole("heading", { name: "Obra 1" });
    fireEvent.click(screen.getByRole("button", { name: "randomize" }));
    const first = screen.getByRole("heading", { level: 2 }).textContent;
    fireEvent.click(screen.getByRole("button", { name: "randomizeAgain" }));
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe(first);
  });

  it("«Otra vez» deja el foco donde está y anuncia la obra nueva", async () => {
    respond({ items: [item(1), item(2)] });
    await mount();
    await screen.findByRole("heading", { name: "Obra 1" });
    fireEvent.click(screen.getByRole("button", { name: "randomize" }));
    const again = screen.getByRole("button", { name: "randomizeAgain" });
    again.focus();
    fireEvent.click(again);
    expect(document.activeElement).toBe(again);
    const title = screen.getByRole("heading", { level: 2 }).textContent as string;
    expect(screen.getByRole("status").textContent).toContain(title);
  });

  it("si la portada elegida no carga, sale otra y la rota ya no vuelve", async () => {
    respond({ items: [item(1), item(2)] });
    const { container } = await mount();
    await screen.findByRole("heading", { name: "Obra 1" });
    fireEvent.click(screen.getByRole("button", { name: "randomize" }));
    const first = screen.getByRole("heading", { level: 2 }).textContent;
    fireEvent.error(container.querySelector(".k2d-pick img") as Element);
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe(first);
  });

  it("sin nada entre lo que elegir, sigue visible y apagado", async () => {
    respond({ items: [item(1, { poster: undefined })] });
    await mount();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("results:0"));
    expect((screen.getByRole("button", { name: "randomize" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Descubrir v2: paginación", () => {
  it("con error en una página interior se puede volver atrás", async () => {
    setUrl("type=movie&page=5");
    respond({ fetchErrorKind: "rate-limit" });
    await mount();
    await waitFor(() => expect(screen.getByRole("navigation")).toBeTruthy());
    expect((screen.getByRole("button", { name: "previous" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("mientras se pide otra página, los botones esperan", async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const fetchMock = vi.fn(async (_url: string) => {
      if (fetchMock.mock.calls.length > 1) await gate;
      return { json: async () => ({ items: [item(1)], hasMore: true, totalPages: 3, fetchErrorKind: null }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = await mount();
    await screen.findByTestId("pagination-next");
    h.params = new URLSearchParams("type=movie&page=2");
    view.rerender(<DiscoverScreen />);
    await waitFor(() => expect((screen.getByTestId("pagination-next") as HTMLButtonElement).disabled).toBe(true));
    await act(async () => release());
  });
});

describe("Descubrir v2: filtros", () => {
  it("un filtro de opción única se quita al repetirlo y vuelve a la página 1", async () => {
    setUrl("type=movie&page=2&year=2024");
    respond({ items: [item(1)] });
    await mount();
    fireEvent.click(screen.getByTestId("filter-trigger-year"));
    fireEvent.click(await screen.findByTestId("filter-opt-year-2024"));
    expect(pushed()).toEqual(["/es/discover?type=movie&page=1"]);
  });

  it("«Quitar filtros» solo sale con filtros puestos", async () => {
    respond({ items: [item(1)] });
    const { unmount } = await mount();
    expect(screen.queryByRole("button", { name: "reset" })).toBeNull();
    unmount();
    setUrl("type=movie&page=1&year=2024");
    respond({ items: [item(1)] });
    await mount();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "reset" }));
    });
    expect(pushed()).toEqual(["/es/discover?type=movie&page=1"]);
  });
});

describe("Descubrir: conmutador en page.tsx", () => {
  async function page() {
    const { default: DiscoverPage } = await import("@/app/[locale]/(app)/discover/page");
    return DiscoverPage({ params: Promise.resolve({ locale: "es" }), searchParams: Promise.resolve({ type: "tv" }) });
  }

  it("sin el interruptor, la pantalla de siempre", async () => {
    h.ui = false;
    render(await page());
    expect(screen.getByTestId("v1")).toBeTruthy();
  });

  it("con el interruptor, la nueva", async () => {
    h.ui = true;
    respond({ items: [item(1)] });
    render(await page());
    expect(screen.queryByTestId("v1")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "title" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Obra 1" })).toBeTruthy();
  });
});
