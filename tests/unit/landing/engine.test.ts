// @vitest-environment jsdom
// ============================================================
// KULTURA — Motor de la landing v2 sin WebGL (jsdom no tiene contexto):
// no rompe, la portada sigue siendo la imagen plana y los controles funcionan.
// ============================================================

import { describe, it, expect, vi, beforeAll } from "vitest";
import { startLanding, type HeroScene } from "@/components/landing/engine";

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
