/**
 * @vitest-environment node
 *
 * Fase 8.4 — `src/styles/sala/title.css` es exactamente lo que genera
 * `salaTitleCss()` (`src/lib/design/sala-title-css.ts`), y las medidas de
 * Anybody de las que sale (`sala-title-metrics.ts`) son las de los archivos
 * que hay en `assets/fonts/anybody/`.
 *
 * Para regenerar la hoja: `npm run title:sala` (este test con `-u`). Las
 * medidas: `node scripts/gen-sala-title-metrics.mjs`.
 */
import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, resolve, sep } from "path";
import { describe, expect, it } from "vitest";
import { salaTitleCss } from "@/lib/design/sala-title-css";
import {
  SALA_TITLE_ADVANCES_RAW,
  SALA_TITLE_FALLBACK,
  SALA_TITLE_FONT_SHA256,
  SALA_TITLE_KERNING,
  SALA_TITLE_WEIGHT,
} from "@/lib/design/sala-title-metrics";
import { SALA_TITLE_STRETCH_MAX, SALA_TITLE_STRETCH_MIN } from "@/lib/design/sala-title";
import { SALA_FAMILY, SALA_FONT, SALA_TYPE } from "@/lib/design/sala-tokens";

const ROOT = resolve(__dirname, "../../..");

it("title.css coincide con salaTitleCss()", async () => {
  await expect(salaTitleCss()).toMatchFileSnapshot(resolve(ROOT, "src/styles/sala/title.css"));
});

describe("medidas de Anybody", () => {
  it("son las de los archivos del repo", () => {
    const hash = createHash("sha256");
    for (const file of ["Anybody-latin-wdth-wght.woff2", "Anybody-latin-ext-wdth-wght.woff2"]) {
      hash.update(readFileSync(resolve(ROOT, "assets/fonts/anybody", file)));
    }
    expect(hash.digest("hex"), "Vuelve a lanzar scripts/gen-sala-title-metrics.mjs").toBe(SALA_TITLE_FONT_SHA256);
  });

  it("se midieron al peso del rótulo", () => {
    expect(SALA_TITLE_WEIGHT).toBe(SALA_TYPE.title.weight);
  });

  it("el interletraje nunca ensancha: la suma de avances es un tope", () => {
    expect(SALA_TITLE_KERNING.max).toBeLessThanOrEqual(0.001);
  });

  it("cada carácter crece con la anchura", () => {
    const entries = SALA_TITLE_ADVANCES_RAW.split(" ").map((e) => e.split(":").map((n) => parseInt(n, 36)));
    expect(entries.length).toBeGreaterThan(500);
    for (const [cp, lo, mid, hi] of entries) {
      expect(lo, `U+${cp.toString(16)}`).toBeLessThanOrEqual(mid);
      expect(mid, `U+${cp.toString(16)}`).toBeLessThanOrEqual(hi);
    }
    // Lo que la biblia pone de ejemplo está medido.
    const known = new Set(entries.map(([cp]) => cp));
    for (const ch of "Parásitos ¿ñ? Kieślowski 0123456789 ÁÉÍÓÚÜ") expect(known.has(ch.codePointAt(0)!), ch).toBe(true);
  });
});

describe("respaldo de Anybody", () => {
  const css = salaTitleCss();
  const faces = css
    .split("@font-face")
    .slice(1)
    .map((b) => b.slice(0, b.indexOf("}")));

  it("los tramos cubren el eje entero, 50–150 %, sin huecos ni solapes", () => {
    expect(SALA_TITLE_FALLBACK[0].from).toBe(SALA_TITLE_STRETCH_MIN);
    expect(SALA_TITLE_FALLBACK.at(-1)!.to).toBe(SALA_TITLE_STRETCH_MAX);
    SALA_TITLE_FALLBACK.slice(1).forEach((b, i) => expect(b.from).toBe(SALA_TITLE_FALLBACK[i].to + 1));
    expect(faces).toHaveLength(SALA_TITLE_FALLBACK.length);
  });

  it("cada tramo es más estrecho que Anybody (nunca más ancho) y crece con la anchura", () => {
    SALA_TITLE_FALLBACK.forEach((b, i) => {
      expect(b.sizeAdjust).toBeLessThan(b.mean);
      if (i > 0) expect(b.sizeAdjust).toBeGreaterThan(SALA_TITLE_FALLBACK[i - 1].sizeAdjust);
    });
  });

  it("solo usa fuentes del sistema, con sus métricas y solo para lo que cubre Anybody", () => {
    for (const face of faces) {
      expect(face).toContain(`font-family: "${SALA_FAMILY.displayFallback}"`);
      expect(face).not.toMatch(/url\(/);
      expect(face).toMatch(/src: local\("Arial Bold"\)/);
      expect(face).toMatch(/size-adjust: [\d.]+%;/);
      expect(face).toMatch(/ascent-override: [\d.]+%;/);
      expect(face).toMatch(/descent-override: [\d.]+%;/);
      expect(face).toMatch(/unicode-range: U\+/);
    }
  });

  it("va en la pila del rótulo justo detrás de Anybody, antes de las CJK", () => {
    for (const stack of [SALA_FONT.display.default, SALA_FONT.display.ko]) {
      expect(stack.startsWith(`"${SALA_FAMILY.display}", "${SALA_FAMILY.displayFallback}", "Noto Sans`)).toBe(true);
    }
    expect(SALA_FONT.text.default).not.toContain(SALA_FAMILY.displayFallback);
  });
});

describe("apagados del fundido", () => {
  const css = salaTitleCss();

  it("solo existe sin movimiento reducido, sin más contraste y sin colores forzados", () => {
    const at = css.indexOf("background-clip: text;");
    const media = css.lastIndexOf("@media", at);
    expect(css.slice(media, css.indexOf("{", media))).toContain(
      "(prefers-reduced-motion: no-preference) and (prefers-contrast: no-preference) and (forced-colors: none)",
    );
    // Ninguna regla de fundido fuera de ese bloque.
    expect(css.slice(0, media)).not.toContain("background-clip: text;");
  });

  it("el interruptor de la app lo apaga igual que el del sistema", () => {
    // En un antepasado o en la propia sala.
    expect(css).toMatch(/\[data-sala-motion="reduce"\] \.sala-stage \.sala-stage-heading,\s*\.sala-stage\[data-sala-motion="reduce"\] \.sala-stage-heading \{\s*background: none;/);
  });

  it("con más contraste el velo no baja de 0,85", () => {
    expect(css).toMatch(/@media \(prefers-contrast: more\) \{\s*\.sala-stage \{\s*--sala-stage-veil-min: 0\.85;/);
    expect(css).toContain("max(var(--sala-stage-veil, 0.7), var(--sala-stage-veil-min, 0))");
  });
});

describe("la app de hoy no carga la hoja del rótulo", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });

  it("nadie en src/app la importa", () => {
    const importers = walk(resolve(ROOT, "src/app"))
      .filter((f) => /\.(ts|tsx|css)$/.test(f))
      .filter((f) => /styles\/sala\/|components\/sala\//.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).split(sep).join("/"));
    expect(importers).toEqual([]);
  });
});
