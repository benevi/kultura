// @vitest-environment jsdom
/**
 * Tests unitarios — vigilar el tamaño de una caja en píxeles físicos: un solo
 * observador para todas, y aviso también cuando cambia la densidad de la
 * pantalla sin que cambie la caja.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { watchBox as WatchBox } from "@/lib/design/box-watch";

let watchBox: typeof WatchBox;

let observadores: Array<{ avisar: (cajas: Element[]) => void; observadas: Set<Element> }>;
let consultas: Array<{ media: string; cambiar: () => void; escuchas: number }>;

beforeEach(async () => {
  observadores = [];
  consultas = [];
  // El módulo guarda un observador para todos: cada prueba, con el suyo.
  vi.resetModules();
  ({ watchBox } = await import("@/lib/design/box-watch"));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observadas = new Set<Element>();
      constructor(aviso: (entradas: Array<{ target: Element }>) => void) {
        observadores.push({ avisar: (cajas) => aviso(cajas.map((target) => ({ target }))), observadas: this.observadas });
      }
      observe(caja: Element) {
        this.observadas.add(caja);
      }
      unobserve(caja: Element) {
        this.observadas.delete(caja);
      }
      disconnect() {
        this.observadas.clear();
      }
    }
  );
  vi.stubGlobal("matchMedia", (media: string) => {
    const avisos = new Set<() => void>();
    const consulta = { media, cambiar: () => Array.from(avisos).forEach((aviso) => aviso()), escuchas: 0 };
    consultas.push(consulta);
    return {
      media,
      addEventListener: (_tipo: string, aviso: () => void) => {
        avisos.add(aviso);
        consulta.escuchas = avisos.size;
      },
      removeEventListener: (_tipo: string, aviso: () => void) => {
        avisos.delete(aviso);
        consulta.escuchas = avisos.size;
      },
    };
  });
  vi.stubGlobal("devicePixelRatio", 1);
});

afterEach(() => vi.unstubAllGlobals());

/** Una caja que mide esto en píxeles CSS (jsdom no maqueta). */
function caja(ancho: number, alto: number) {
  const nodo = document.createElement("div");
  const medida = { ancho, alto };
  nodo.getBoundingClientRect = () => ({ width: medida.ancho, height: medida.alto }) as DOMRect;
  return { nodo, medida };
}

describe("watchBox", () => {
  it("avisa al suscribirse, ya, con la caja en píxeles físicos", () => {
    vi.stubGlobal("devicePixelRatio", 3);
    const aviso = vi.fn();
    const dejar = watchBox(caja(171, 256).nodo, aviso);
    expect(aviso).toHaveBeenCalledExactlyOnceWith({ width: 513, height: 768 }, 3);
    dejar();
  });

  it("un solo observador para todas las cajas, sean una o cien", () => {
    const dejar = Array.from({ length: 100 }, () => watchBox(caja(160, 240).nodo, vi.fn()));
    expect(observadores).toHaveLength(1);
    expect(observadores[0].observadas.size).toBe(100);
    // Y una sola escucha de densidad.
    expect(consultas).toHaveLength(1);
    dejar.forEach((d) => d());
    expect(observadores[0].observadas.size).toBe(0);
    expect(consultas[0].escuchas).toBe(0);
  });

  it("avisa cuando la caja cambia de tamaño, solo a quien la mira", () => {
    const a = caja(160, 240);
    const b = caja(160, 240);
    const avisoA = vi.fn();
    const avisoB = vi.fn();
    const dejarA = watchBox(a.nodo, avisoA);
    const dejarB = watchBox(b.nodo, avisoB);
    a.medida.ancho = 200;
    a.medida.alto = 300;
    observadores[0].avisar([a.nodo]);
    expect(avisoA).toHaveBeenLastCalledWith({ width: 200, height: 300 }, 1);
    expect(avisoB).toHaveBeenCalledTimes(1);
    dejarA();
    dejarB();
  });

  it("avisa cuando cambia la densidad sin que cambie la caja, y sigue escuchando la nueva", () => {
    const aviso = vi.fn();
    const dejar = watchBox(caja(160, 240).nodo, aviso);
    expect(consultas[0].media).toBe("(resolution: 1dppx)");

    vi.stubGlobal("devicePixelRatio", 2);
    consultas[0].cambiar();
    expect(aviso).toHaveBeenLastCalledWith({ width: 320, height: 480 }, 2);
    expect(consultas[1].media).toBe("(resolution: 2dppx)");
    expect(consultas[0].escuchas).toBe(0);

    vi.stubGlobal("devicePixelRatio", 3);
    consultas[1].cambiar();
    expect(aviso).toHaveBeenLastCalledWith({ width: 480, height: 720 }, 3);
    dejar();
    expect(consultas[2].escuchas).toBe(0);
  });

  it("al dejarlo no avisa más", () => {
    const { nodo } = caja(160, 240);
    const aviso = vi.fn();
    watchBox(nodo, aviso)();
    observadores[0].avisar([nodo]);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("sin ResizeObserver ni matchMedia mide una vez y no rompe", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("matchMedia", undefined);
    const aviso = vi.fn();
    const dejar = watchBox(caja(160, 240).nodo, aviso);
    expect(aviso).toHaveBeenCalledExactlyOnceWith({ width: 160, height: 240 }, 1);
    dejar();
  });
});
