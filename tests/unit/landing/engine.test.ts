// @vitest-environment jsdom
// ============================================================
// KULTURA — Motor de la landing v2 sin WebGL (jsdom no tiene contexto):
// no rompe, la portada sigue siendo la imagen plana y los controles funcionan.
// ============================================================

import { describe, it, expect, vi, beforeAll } from "vitest";
import { cutThreshold, startLanding, type HeroScene } from "@/components/landing/engine";

const scene = (n: number): HeroScene => ({
  image: `/landing/fallback/hero-${n}.jpg`, depth: `/landing/fallback/hero-${n}_d.jpg`, w: 1920, h: 1080,
  th: 0.4, fx: 0.5, fy: 0.6, layered: true, accent: "#0b93a9", caption: `Escena ${n}`, meta: "· Serie · 2025",
});

beforeAll(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
});

function mount() {
  document.body.innerHTML = `
    <div class="kl"><canvas class="kl-gl"></canvas>
      <section class="kl-stage"><img class="kl-ph" src="/landing/fallback/hero-0.jpg">
        <canvas class="kl-bg"></canvas><h1 class="kl-word">KULTURA</h1><canvas class="kl-fg"></canvas>
        <p class="kl-cap"></p>
        <div class="kl-segs"><button data-i="0"><i></i></button><button data-i="1"><i></i></button>
          <button class="kl-pause" data-pause="Pausar" data-play="Reanudar"><span data-icon="pause"></span><span data-icon="play" hidden></span></button></div>
      </section>
      <div class="kl-win kl-holdable" data-img="/a.jpg" data-depth="/a_d.jpg" data-w="2" data-h="3" data-altimg="/b.jpg" data-altdepth="/b_d.jpg" data-altw="2" data-alth="3"></div>
    </div>`;
  return document.querySelector<HTMLElement>(".kl")!;
}

describe("motor de la landing sin WebGL", () => {
  it("arranca, pinta el pie de la escena y se desmonta sin errores", () => {
    const root = mount();
    const stop = startLanding(root, [scene(0), scene(1)]);
    expect(root.querySelector(".kl-cap")!.textContent).toContain("Escena 0");
    expect(root.querySelector(".kl-stage")!.hasAttribute("data-gl")).toBe(false);
    expect(root.querySelector(".kl-win")!.hasAttribute("data-gl")).toBe(false);
    stop();
  });

  it("los segmentos cambian de escena y la imagen plana la sigue", () => {
    const root = mount();
    const stop = startLanding(root, [scene(0), scene(1)]);
    root.querySelector<HTMLButtonElement>('[data-i="1"]')!.click();
    expect(root.querySelector(".kl-cap")!.textContent).toContain("Escena 1");
    expect(root.querySelector<HTMLImageElement>(".kl-stage img")!.getAttribute("src")).toBe("/landing/fallback/hero-1.jpg");
    expect(root.querySelector('[data-i="1"]')!.getAttribute("aria-current")).toBe("true");
    stop();
  });

  it("con «reducir movimiento» el paso automático empieza en pausa", () => {
    const root = mount();
    const stop = startLanding(root, [scene(0), scene(1)]);
    const pause = root.querySelector<HTMLButtonElement>(".kl-pause")!;
    expect(pause.getAttribute("aria-pressed")).toBe("true");
    expect(pause.getAttribute("aria-label")).toBe("Reanudar");
    pause.click();
    expect(pause.getAttribute("aria-label")).toBe("Pausar");
    stop();
  });

  it("mantener pulsado con el teclado alterna la tarjeta de amigos", () => {
    const root = mount();
    const stop = startLanding(root, [scene(0)]);
    const card = root.querySelector<HTMLElement>(".kl-holdable")!;
    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(card.classList.contains("is-on")).toBe(true);
    expect(card.getAttribute("aria-pressed")).toBe("true");
    stop();
  });
});

describe("umbral de la capa delantera", () => {
  // Mapa de 10×10 en escala de grises (RGBA); la franja del nombre son las filas 3-5.
  const depth = (f: (x: number, y: number) => number) => {
    const px = new Uint8ClampedArray(10 * 10 * 4);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) px[(y * 10 + x) * 4] = Math.round(f(x, y) * 255);
    return px;
  };

  it("conserva el umbral semanal si ya corta limpio", () => {
    expect(cutThreshold(depth((x) => (x < 2 ? 0.9 : 0.05)), 10, 10, 0.4)).toBe(0.4);
  });

  it("busca otro umbral si el semanal cae en zona dudosa", () => {
    const t = cutThreshold(depth((x) => (x < 2 ? 0.9 : 0.45)), 10, 10, 0.4);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan(0.53);
    expect(t!).toBeLessThan(0.82);
  });

  it("sin recorte si la figura taparía casi todo el nombre", () => {
    expect(cutThreshold(depth((x) => (x < 1 ? 0.05 : 0.9)), 10, 10, 0.4)).toBeNull();
  });

  it("acepta que la figura tape hasta el 60 % del nombre, no más", () => {
    // 5 de 10 columnas delante (50 %): vale.
    expect(cutThreshold(depth((x) => (x < 5 ? 0.9 : 0.05)), 10, 10, 0.4)).toBe(0.4);
    // 7 de 10 (70 %): ningún umbral lo deja por debajo del 60 %.
    expect(cutThreshold(depth((x) => (x < 7 ? 0.9 : 0.05)), 10, 10, 0.4)).toBeNull();
  });

  it("tolera hasta un 15 % de píxeles dudosos", () => {
    // Mapa de 20 columnas: con 3 dudosas de 20 (15 %) el umbral semanal vale;
    // con 4 (20 %) se descarta y se busca otro lejos de ellas.
    const wide = (bad: number) => {
      const px = new Uint8ClampedArray(20 * 10 * 4);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) {
        const v = x < 4 ? 0.9 : x < 4 + bad ? 0.4 : 0.05;
        px[(y * 20 + x) * 4] = Math.round(v * 255);
      }
      return px;
    };
    expect(cutThreshold(wide(3), 20, 10, 0.4)).toBe(0.4);
    const t = cutThreshold(wide(4), 20, 10, 0.4);
    expect(t).not.toBeNull();
    expect(Math.abs(t! - 0.4)).toBeGreaterThan(0.08);
  });

  it("sin recorte si no hay figura separable", () => {
    expect(cutThreshold(depth(() => 0.43), 10, 10, 0.4)).toBeNull();
  });

  it("solo cuenta la franja del nombre (27-60 % del alto)", () => {
    expect(cutThreshold(depth((x, y) => (y >= 3 && y < 6 ? (x < 2 ? 0.9 : 0.05) : 0.41)), 10, 10, 0.4)).toBe(0.4);
  });
});
