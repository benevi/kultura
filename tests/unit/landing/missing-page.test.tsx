// ============================================================
// KULTURA — «Te faltan»: el sobre llena los huecos (escena 3D diferida) o,
// sin ella, el álbum se llena quieto. El primer pintado nunca espera a three.
// ============================================================

import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SobreSceneOptions } from "@/lib/landing/sobre-scene";

const h = vi.hoisted(() => ({
  opts: null as SobreSceneOptions | null,
  throws: false,
  scene: { setProgress: vi.fn(), play: vi.fn(), layout: vi.fn(), pause: vi.fn(), dispose: vi.fn() },
}));

vi.mock("@/lib/landing/sobre-scene", () => ({
  createSobreScene: (opts: SobreSceneOptions) => {
    if (h.throws) throw new Error("sin WebGL 2");
    h.opts = opts;
    return h.scene;
  },
}));

import { MissingPage, type MissingItem } from "@/components/landing/MissingPage";

const items: MissingItem[] = Array.from({ length: 8 }, (_, i) => ({
  id: `book_${i}`,
  title: `Libro ${i}`,
  type: "book",
  poster: `https://covers.openlibrary.org/b/id/${i}-L.jpg`,
  foil: false,
}));

function renderPage() {
  return render(
    <MissingPage
      heading="Te faltan"
      startNumber={9}
      items={items}
      cromos={items.map((it) => (
        <div key={it.id} data-cromo="" data-testid={`cromo-${it.id}`} />
      ))}
      pending={items.map((_, i) => `Hueco ${9 + i}, te falta:`)}
      formatLabels={{ movie: "Película", tv: "Serie", anime: "Anime", manga: "Manga", game: "Videojuego", book: "Libro", comic: "Cómic" }}
    />
  );
}

let media: Record<string, boolean>;
const originalGL = (window as unknown as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext;

function setEnv({ reduce = false, coarse = false, width = 1440, webgl2 = true } = {}) {
  media = { "(prefers-reduced-motion: reduce)": reduce, "(pointer: coarse)": coarse };
  window.matchMedia = ((q: string) => ({
    matches: media[q] ?? false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  const w = window as unknown as { WebGL2RenderingContext?: unknown };
  if (webgl2) w.WebGL2RenderingContext = function WebGL2() {};
  else delete w.WebGL2RenderingContext;
}

const filled = (container: HTMLElement) => container.querySelectorAll("ol > li [data-filled]").length;

class IO {
  static all: IO[] = [];
  constructor(private cb: IntersectionObserverCallback) {
    IO.all.push(this);
  }
  observe() {}
  disconnect() {}
  fire(ratio: number) {
    this.cb([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], this as never);
  }
}

beforeEach(() => {
  h.opts = null;
  h.throws = false;
  Object.values(h.scene).forEach((fn) => fn.mockClear());
  IO.all = [];
  vi.stubGlobal("IntersectionObserver", IO);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  (window as unknown as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext = originalGL;
});

describe("MissingPage", () => {
  it("primer pintado: huecos numerados con el título impreso, ninguno lleno y el sobre cerrado", () => {
    setEnv();
    const { container } = renderPage();
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Hueco 9, te falta: Libro 0");
    // Antes de que el navegador quede libre, nada se llena ni se pide three.
    expect(filled(container)).toBe(0);
    expect(h.opts).toBeNull();
    expect(container.querySelector("canvas")?.className).toContain("invisible");
  });

  it("movimiento reducido: los seis primeros huecos se llenan al instante, sin escena ni pegado", () => {
    setEnv({ reduce: true });
    const { container } = renderPage();
    expect(filled(container)).toBe(6);
    expect(container.querySelector(".animate-paste")).toBeNull();
    expect(container.querySelector("svg[data-sobre]")?.hasAttribute("data-torn")).toBe(true);
    expect(h.opts).toBeNull();
  });

  it("sin WebGL 2: álbum quieto con un pegado escalonado de 40 ms (cuatro en el móvil)", () => {
    setEnv({ webgl2: false, width: 390, coarse: true });
    const { container } = renderPage();
    expect(filled(container)).toBe(4);
    const pasted = Array.from(container.querySelectorAll(".animate-paste"));
    expect(pasted.map((el) => el.className.match(/animation-delay:(\d+)ms/)?.[1])).toEqual(["0", "40", "80", "120"]);
  });

  it("escritorio capaz: tras el primer pintado carga la escena, el scroll marca el avance y cada cromo posado se queda en su hueco", async () => {
    vi.useFakeTimers();
    setEnv();
    const { container } = renderPage();
    await act(async () => {
      vi.advanceTimersByTime(250);
      await vi.dynamicImportSettled?.();
    });
    vi.useRealTimers();
    await waitFor(() => expect(h.opts).not.toBeNull());
    expect(h.opts!.cards).toHaveLength(6);
    expect(h.opts!.cards[0].src).toBe(`/_next/image?url=${encodeURIComponent(items[0].poster)}&w=384&q=70`);
    expect(h.scene.setProgress).toHaveBeenCalledWith(0);
    expect(container.querySelector("canvas")?.className).not.toContain("invisible");

    act(() => h.opts!.onTear?.());
    expect(container.querySelector("svg[data-sobre]")?.hasAttribute("data-torn")).toBe(true);
    act(() => h.opts!.onLand(0, true));
    expect(filled(container)).toBe(1);
    // Al volver a subir, el cromo se levanta del hueco.
    act(() => h.opts!.onLand(0, false));
    expect(filled(container)).toBe(0);
  });

  it("si la escena no arranca, el álbum se llena quieto", async () => {
    vi.useFakeTimers();
    h.throws = true;
    setEnv();
    const { container } = renderPage();
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    vi.useRealTimers();
    await waitFor(() => expect(filled(container)).toBe(6));
  });

  it("móvil: three solo se pide al acercarse la página y la pasada única empieza al verse", async () => {
    vi.useFakeTimers();
    setEnv({ width: 390, coarse: true });
    renderPage();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(h.opts).toBeNull();
    await act(async () => {
      IO.all[0].fire(1);
      vi.advanceTimersByTime(250);
    });
    vi.useRealTimers();
    await waitFor(() => expect(h.opts).not.toBeNull());
    expect(h.opts!.cards).toHaveLength(4);
    act(() => IO.all[IO.all.length - 1].fire(0.5));
    expect(h.scene.play).toHaveBeenCalledTimes(1);
  });
});
