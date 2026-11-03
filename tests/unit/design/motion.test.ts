/**
 * Movimiento del álbum (`src/lib/motion`): duraciones del sistema, el pegado
 * escalonado (40 ms por cromo, ≤ 600 ms en total), nada con movimiento
 * reducido, GSAP solo con import dinámico y nunca en el layout.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  DURATION,
  PASTE_MAX_MS,
  PASTE_STEP_MS,
  cubicBezier,
  easePaste,
  pasteGrid,
  pasteSchedule,
  prefersReducedMotion,
} from "@/lib/motion";
import { RAW_TOKENS } from "./css-tokens";

const ROOT = resolve(__dirname, "../../..");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tokens de movimiento", () => {
  it("180 / 240 / 360 ms y 200 ms el cambio de ruta, igual en CSS y en JS", () => {
    expect(DURATION).toEqual({ fast: 180, base: 240, slow: 360, route: 200 });
    expect(RAW_TOKENS["--duration-fast"]).toBe("180ms");
    expect(RAW_TOKENS["--duration-base"]).toBe("240ms");
    expect(RAW_TOKENS["--duration-slow"]).toBe("360ms");
    expect(RAW_TOKENS["--duration-route"]).toBe("200ms");
    expect(RAW_TOKENS["--ease-out"]).toBe("cubic-bezier(0.2, 0.8, 0.2, 1)");
    expect(RAW_TOKENS["--ease-paste"]).toBe("cubic-bezier(0.3, 1.3, 0.5, 1)");
  });

  it("la curva de pegar se pasa un poco y se asienta en 1", () => {
    expect(easePaste(0)).toBe(0);
    expect(easePaste(1)).toBe(1);
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => easePaste(i / 50)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.15);
    const linear = cubicBezier(0, 0, 1, 1);
    expect(linear(0.5)).toBeCloseTo(0.5, 3);
  });
});

describe("pasteSchedule", () => {
  it("40 ms por cromo mientras quepa en 600 ms", () => {
    expect(pasteSchedule(0).total).toBe(0);
    expect(pasteSchedule(1)).toEqual({ duration: 240, stagger: 0, total: 240 });
    expect(pasteSchedule(10)).toEqual({ duration: 240, stagger: PASTE_STEP_MS, total: 600 });
  });

  it.each([11, 24, 60, 200])("con %i cromos el total no pasa de 600 ms", (n) => {
    const s = pasteSchedule(n);
    expect(s.total).toBeLessThanOrEqual(PASTE_MAX_MS + 1e-9);
    expect(s.stagger).toBeLessThan(PASTE_STEP_MS);
  });
});

describe("movimiento reducido", () => {
  it("sin matchMedia (servidor, tests) se responde que sí: ante la duda, no se anima", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(true);
  });

  it("pasteGrid no hace nada con movimiento reducido (ni carga GSAP)", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q }));
    const el = { nodeType: 1 } as unknown as Element;
    await expect(pasteGrid([el])).resolves.toBe(false);
  });
});

describe("GSAP fuera del JS inicial", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name);
      return e.isDirectory() ? walk(full) : /\.(tsx?)$/.test(e.name) ? [full] : [];
    });
  }

  it("es dependencia exacta y nadie lo importa de forma estática", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.gsap).toMatch(/^\d+\.\d+\.\d+$/);
    const offenders = walk(join(ROOT, "src")).filter((f) =>
      /^\s*import\s+[^;]*from\s+["']gsap(\/[^"']*)?["']/m.test(readFileSync(f, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("solo `loadGsap` lo pide, con import dinámico, y el layout no lo toca", () => {
    const motion = readFileSync(join(ROOT, "src/lib/motion/index.ts"), "utf8");
    expect(motion).toMatch(/import\("gsap"\)/);
    for (const layout of ["src/app/layout.tsx", "src/app/[locale]/layout.tsx"]) {
      expect(readFileSync(join(ROOT, layout), "utf8")).not.toMatch(/gsap|@\/lib\/motion/);
    }
  });
});
