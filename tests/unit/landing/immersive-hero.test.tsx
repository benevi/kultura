// ============================================================
// KULTURA — Hero de la landing: galería de fondo y pausa (D-11, ACC-6, REN-4)
// La escena WebGL se sustituye por un doble: aquí se prueba CUÁNDO se crea,
// que se pausa de verdad y que no existe cuando no debe.
// ============================================================

import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { HeroCopy } from "@/lib/landing/immersive";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

const scene = {
  setProgress: vi.fn(),
  setPointer: vi.fn(),
  resize: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
};
const createImmersiveScene = vi.fn(() => scene);
vi.mock("@/lib/landing/immersive-scene", () => ({ createImmersiveScene }));

import { Hero } from "@/components/landing/Hero";
import { ImmersiveBackdrop } from "@/components/landing/ImmersiveBackdrop";
import { MotionToggle } from "@/components/landing/MotionToggle";
import { heroMotion } from "@/lib/landing/motion";

const copy: HeroCopy = {
  title: ["Tu watchlist de ", { type: "movie", text: "cine" }, " y ", { type: "book", text: "libros" }],
  sub: "Sub",
  badge: "7 formatos, 1 sola lista",
  cta: "Crear mi cuenta gratis",
  demo: "Ver la demo",
  locale: "es",
};

/** El hero como en la página: texto del servidor + fondo de cliente. */
function HeroUnderTest() {
  return <Hero copy={copy} backdrop={<ImmersiveBackdrop items={[]} />} />;
}

/** matchMedia controlable: `reduce` y ancho, con eventos `change`. */
function installMedia({ reduce, width }: { reduce: boolean; width: number }) {
  const lists: Array<{ query: string; fns: Set<() => void>; mql: { matches: boolean } }> = [];
  const state = { reduce, width };
  const evaluate = (q: string) => {
    if (q.includes("prefers-reduced-motion: reduce")) return state.reduce;
    if (q.includes("min-width")) return state.width >= 768 && !state.reduce;
    return false;
  };
  window.matchMedia = vi.fn((query: string) => {
    const fns = new Set<() => void>();
    const mql = {
      get matches() {
        return evaluate(query);
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => fns.add(fn),
      removeEventListener: (_: string, fn: () => void) => fns.delete(fn),
    };
    lists.push({ query, fns, mql });
    return mql as unknown as MediaQueryList;
  }) as unknown as typeof window.matchMedia;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  return {
    set(next: Partial<typeof state>) {
      Object.assign(state, next);
      Object.defineProperty(window, "innerWidth", { configurable: true, value: state.width });
      lists.forEach((l) => l.fns.forEach((fn) => fn()));
    },
  };
}

class IO {
  observe() {}
  disconnect() {}
}

/** Deja correr el `import()` dinámico y el callback de inactividad. */
async function flushScene() {
  await act(async () => {
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    await vi.dynamicImportSettled?.();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  heroMotion.set("off");
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
  Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 8 });
  Object.defineProperty(document, "readyState", { configurable: true, value: "complete" });
  // jsdom no tiene requestIdleCallback: el componente cae a setTimeout.
});

afterEach(() => {
  vi.useRealTimers();
});

describe("hero · el mensaje no depende de la animación", () => {
  it("titular, subtítulo y botones se pintan aunque no haya galería", () => {
    installMedia({ reduce: true, width: 1440 });
    render(<HeroUnderTest />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tu watchlist de cine y libros");
    expect(screen.getByRole("link", { name: "Crear mi cuenta gratis" })).toHaveAttribute("href", "/login?mode=register");
    expect(screen.getByRole("button", { name: "Ver la demo" })).toBeInTheDocument();
  });
});

describe("hero · cuándo hay galería WebGL", () => {
  it("con reducir movimiento NO se crea contexto WebGL ni lienzo", async () => {
    installMedia({ reduce: true, width: 1440 });
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    const { container } = render(<HeroUnderTest />);
    await flushScene();
    expect(container.querySelector("canvas")).toBeNull();
    expect(createImmersiveScene).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
    expect(heroMotion.get()).toBe("off");
  });

  it("en móvil (< 768 px) tampoco hay galería (MOV-13)", async () => {
    installMedia({ reduce: false, width: 390 });
    const { container } = render(<HeroUnderTest />);
    await flushScene();
    expect(container.querySelector("canvas")).toBeNull();
    expect(createImmersiveScene).not.toHaveBeenCalled();
  });

  it("con 4 núcleos o menos, fondo quieto (REN-4)", async () => {
    installMedia({ reduce: false, width: 1440 });
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 4 });
    const { container } = render(<HeroUnderTest />);
    await flushScene();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("en escritorio capaz, la escena se crea DESPUÉS de la carga, no al montar", async () => {
    installMedia({ reduce: false, width: 1440 });
    Object.defineProperty(document, "readyState", { configurable: true, value: "loading" });
    const { container } = render(<HeroUnderTest />);
    expect(container.querySelector("canvas")).not.toBeNull();
    await flushScene();
    expect(createImmersiveScene).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(new Event("load"));
    });
    await flushScene();
    expect(createImmersiveScene).toHaveBeenCalledTimes(1);
    expect(heroMotion.get()).toBe("running");

    // Mientras la cámara presenta un formato, su palabra se ilumina en el h1.
    const section = container.querySelector("section") as HTMLElement;
    expect(section.dataset.active).toBeUndefined();
    await act(async () => {
      vi.advanceTimersByTime(4000 + 3000);
    });
    expect(["movie", "tv", "anime", "manga", "game", "book", "comic"]).toContain(section.dataset.active);
    expect(screen.getByText("cine").className).toContain("group-data-[active=movie]/hero:");
    // Al acabar la intro el titular vuelve a su color.
    await act(async () => {
      vi.advanceTimersByTime(12000);
    });
    expect(section.dataset.active).toBeUndefined();
  });

  it("si se activa 'reducir movimiento' con la página abierta, la galería se retira", async () => {
    const media = installMedia({ reduce: false, width: 1440 });
    const { container } = render(<HeroUnderTest />);
    await flushScene();
    expect(createImmersiveScene).toHaveBeenCalledTimes(1);
    act(() => media.set({ reduce: true }));
    expect(container.querySelector("canvas")).toBeNull();
    expect(scene.dispose).toHaveBeenCalled();
    expect(heroMotion.get()).toBe("off");
  });
});

describe("hero · pausa (WCAG 2.2.2)", () => {
  it("el botón solo existe con animación y para la escena", async () => {
    installMedia({ reduce: false, width: 1440 });
    render(
      <>
        <MotionToggle pauseLabel="Pausar la animación de fondo" region="Animación de fondo" />
        <HeroUnderTest />
      </>
    );
    // Antes de que arranque la escena no hay nada que pausar.
    expect(screen.queryByRole("button", { name: "Pausar la animación de fondo" })).toBeNull();
    await flushScene();
    const button = screen.getByRole("button", { name: "Pausar la animación de fondo" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    // Va antes que el resto de controles (primer Tab).
    const focusables = Array.from(document.querySelectorAll("a, button"));
    expect(focusables[0]).toBe(button);

    scene.stop.mockClear();
    fireEvent.click(button);
    expect(heroMotion.get()).toBe("paused");
    expect(scene.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pausar la animación de fondo" })).toHaveAttribute("aria-pressed", "true");

    // Pausada, el reloj de la intro no avanza: la escena no recibe progreso nuevo.
    scene.setProgress.mockClear();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(scene.setProgress).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pausar la animación de fondo" }));
    expect(heroMotion.get()).toBe("running");
    expect(scene.start).toHaveBeenCalled();
    // Control: reanudada, la intro vuelve a avanzar.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(scene.setProgress).toHaveBeenCalled();
  });

  it("sin animación (reducir movimiento) no hay botón de pausa", async () => {
    installMedia({ reduce: true, width: 1440 });
    render(
      <>
        <MotionToggle pauseLabel="Pausar" region="Animación" />
        <HeroUnderTest />
      </>
    );
    await flushScene();
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
  });
});
