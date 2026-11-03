/**
 * Rankings: «Guardar» sin cuenta (alta + vuelta a guardarlo) y la inclinación
 * del podio (8° como mucho, perspectiva 800 px, muelle 170/26, pintor según
 * el dispositivo). Funciones puras de src/lib/best/save.ts y tilt.ts.
 */
import { describe, it, expect } from "vitest";
import { hasSessionCookie, saveDestination, saveIntentPath } from "@/lib/best/save";
import {
  isSettled,
  stepSpring,
  targetTilt,
  tiltMode,
  tiltTransform,
  TILT_MAX_DEG,
  type SpringState,
  type TiltEnvironment,
} from "@/lib/best/tilt";

describe("Guardar desde un ranking", () => {
  it("reconoce la cookie de Supabase de la cuenta abierta como el middleware (sb-…)", () => {
    expect(hasSessionCookie("")).toBe(false);
    expect(hasSessionCookie("NEXT_LOCALE=es; theme=dark")).toBe(false);
    expect(hasSessionCookie("NEXT_LOCALE=es; sb-abc-auth-token=xyz")).toBe(true);
  });

  it("pide a la ficha que lo guarde (?guardar=1), respetando una query o un ancla", () => {
    expect(saveIntentPath("/es/media/anime/al-1")).toBe("/es/media/anime/al-1?guardar=1");
    expect(saveIntentPath("/es/media/tv/1?x=2")).toBe("/es/media/tv/1?x=2&guardar=1");
    expect(saveIntentPath("/es/media/tv/1#donde")).toBe("/es/media/tv/1?guardar=1#donde");
  });

  it("sin cuenta abierta: alta con vuelta a la ficha para guardarlo; con la cuenta abierta: directo a la ficha", () => {
    expect(saveDestination("es", "/es/media/anime/al-1", false)).toBe(
      `/es/login?mode=register&next=${encodeURIComponent("/es/media/anime/al-1?guardar=1")}`,
    );
    expect(saveDestination("en", "/en/media/movie/550", true)).toBe("/en/media/movie/550?guardar=1");
  });
});

describe("inclinación del podio", () => {
  const rect = { left: 100, top: 100, width: 200, height: 300 };

  it("mira al puntero y nunca pasa de 8°", () => {
    expect(targetTilt(200, 250, rect)).toEqual({ rx: -0, ry: 0 });
    const right = targetTilt(5000, 250, rect);
    expect(right.ry).toBe(TILT_MAX_DEG);
    const up = targetTilt(200, -5000, rect);
    expect(up.rx).toBe(TILT_MAX_DEG);
    for (const [x, y] of [[0, 0], [9999, 9999], [150, 400]]) {
      const t = targetTilt(x, y, rect);
      expect(Math.abs(t.rx)).toBeLessThanOrEqual(8);
      expect(Math.abs(t.ry)).toBeLessThanOrEqual(8);
    }
  });

  it("perspectiva de 800 px en el transform CSS", () => {
    expect(tiltTransform({ rx: 1, ry: -2 })).toBe("perspective(800px) rotateX(1.00deg) rotateY(-2.00deg)");
  });

  it("el muelle (170/26) se asienta en poco más de un segundo sin pasarse de largo más de un 10 %", () => {
    let s: SpringState = { x: 0, v: 0 };
    let max = 0;
    let t = 0;
    while (!isSettled(s, 8) && t < 2) {
      s = stepSpring(s, 8, 1 / 60);
      max = Math.max(max, s.x);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(1.2);
    expect(max).toBeLessThan(8 * 1.1);
  });

  it("un salto de tiempo (pestaña en segundo plano) no dispara el muelle", () => {
    const s = stepSpring({ x: 0, v: 0 }, 8, 5);
    expect(Math.abs(s.x)).toBeLessThan(8);
  });

  it("three.js solo en escritorio capaz; CSS sin WebGL; nada en el móvil ni con movimiento reducido", () => {
    const desk: TiltEnvironment = { reducedMotion: false, finePointer: true, width: 1440, webgl: true, saveData: false, cores: 8 };
    expect(tiltMode(desk)).toBe("webgl");
    expect(tiltMode({ ...desk, reducedMotion: true })).toBe("none");
    expect(tiltMode({ ...desk, finePointer: false })).toBe("none");
    expect(tiltMode({ ...desk, width: 600 })).toBe("none");
    expect(tiltMode({ ...desk, webgl: false })).toBe("css");
    expect(tiltMode({ ...desk, saveData: true })).toBe("css");
    expect(tiltMode({ ...desk, cores: 2 })).toBe("css");
  });
});
