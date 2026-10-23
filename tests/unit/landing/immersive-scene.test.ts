// ============================================================
// KULTURA — Escena WebGL de la landing: ciclo de vida (sin GPU)
// Un contexto WebGL falso que registra las llamadas: basta para comprobar
// que la escena se duerme cuando no hay nada que pintar y que libera todo.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createImmersiveScene } from "@/lib/landing/immersive-scene";

function fakeGl() {
  const calls: Record<string, number> = {};
  const loseContext = vi.fn();
  const gl = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "getExtension") return (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null);
        if (prop === "getShaderParameter" || prop === "getProgramParameter") return () => true;
        if (/^[A-Z_0-9]+$/.test(prop)) return 1; // constantes (gl.FLOAT, gl.TEXTURE_2D…)
        return (..._args: unknown[]) => {
          calls[prop] = (calls[prop] ?? 0) + 1;
          return {};
        };
      },
    }
  );
  return { gl, calls, loseContext };
}

let frames: Array<(t: number) => void> = [];
let now = 0;

beforeEach(() => {
  frames = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

/** Ejecuta los fotogramas pendientes, avanzando 16 ms por vuelta. */
function pump(n: number) {
  for (let i = 0; i < n && frames.length; i++) {
    const batch = frames;
    frames = [];
    now += 16;
    batch.forEach((cb) => cb(now));
  }
}

function makeScene() {
  const { gl, calls, loseContext } = fakeGl();
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockImplementation(((type: string) =>
    type.startsWith("webgl") ? gl : null) as unknown as typeof canvas.getContext);
  const scene = createImmersiveScene(canvas, [{ src: null, hue: 350 }], { mobile: false, bgCss: "black" });
  return { scene, calls, loseContext };
}

describe("escena · no repinta sin motivo", () => {
  it("tras la intro, con el ratón quieto, deja de pedir fotogramas", () => {
    const { scene, calls } = makeScene();
    scene.setProgress(1);
    scene.start();
    pump(2000); // ~32 s simulados: la cámara llega al muro y se asienta
    expect(frames).toHaveLength(0);
    const drawn = calls.drawArrays;
    pump(100);
    expect(calls.drawArrays).toBe(drawn);
  });

  it("mover el ratón la despierta y vuelve a dormirse al asentarse", () => {
    const { scene } = makeScene();
    scene.setProgress(1);
    scene.start();
    pump(2000);
    expect(frames).toHaveLength(0);
    scene.setPointer(0.5, -0.5);
    expect(frames).toHaveLength(1);
    pump(2000);
    expect(frames).toHaveLength(0);
  });

  it("durante la intro sí sigue pintando (deriva y balanceo)", () => {
    const { scene } = makeScene();
    scene.setProgress(0.3);
    scene.start();
    pump(500);
    expect(frames).toHaveLength(1);
  });

  it("parada no pide fotogramas aunque se mueva el ratón", () => {
    const { scene } = makeScene();
    scene.start();
    scene.stop();
    frames = [];
    scene.setPointer(1, 1);
    expect(frames).toHaveLength(0);
  });
});

describe("escena · dispose", () => {
  it("borra sombreadores, programa, texturas y pierde el contexto", () => {
    const { scene, calls, loseContext } = makeScene();
    scene.dispose();
    expect(calls.deleteShader).toBe(2);
    expect(calls.deleteProgram).toBe(1);
    expect(calls.deleteTexture).toBeGreaterThan(0);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});
