/**
 * @vitest-environment node
 *
 * Tests unitarios — contraste WCAG de los tokens (ACC-4, ACC-9).
 *
 * Se calcula con los valores OKLCH reales de `globals.css` convertidos a sRGB
 * con el mismo recorte que aplica Chrome, sin navegador. Umbrales WCAG 2.1 AA:
 * 4,5:1 para texto (1.4.3) y 3:1 para bordes de campo y foco (1.4.11).
 *
 * Antes del arreglo: el rojo de error daba 4,43 / 4,05 / 3,56 sobre fondo,
 * tarjeta y campo; el botón destructivo 4,28; el campo no tenía borde (1,14:1
 * contra la tarjeta) y el halo de foco del campo daba 1,39:1. Las iniciales en
 * blanco sobre la paleta de avatares pasaban en 1 de 8 colores.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { blend, contrastRatio, toSrgb, type Rgb } from "@/lib/design/color";
import { AVATAR_COLORS } from "@/lib/constants/avatarColors";
import { ROOT, resolvePaperToken, resolveToken } from "./css-tokens";

function rgb(token: string): Rgb {
  const value = token.startsWith("--") ? resolveToken(token) : token;
  const out = toSrgb(value);
  if (!out) throw new Error(`No se puede convertir ${token} = ${value}`);
  return out;
}

const TEXT = 4.5;
const NON_TEXT = 3;

/** Las 9 combinaciones de ACC-4 (+ el borde de error del campo). */
const PAIRS: Array<{ name: string; fg: () => Rgb; bg: () => Rgb; min: number }> = [
  { name: "texto de error sobre fondo de página", fg: () => rgb("--accent-danger-text"), bg: () => rgb("--surface-base"), min: TEXT },
  { name: "texto de error sobre tarjeta", fg: () => rgb("--accent-danger-text"), bg: () => rgb("--surface-default"), min: TEXT },
  { name: "texto de error sobre campo/superficie elevada", fg: () => rgb("--accent-danger-text"), bg: () => rgb("--surface-elevated"), min: TEXT },
  {
    name: "error global del login (texto sobre bg-accent-danger/10 en la tarjeta)",
    fg: () => rgb("--accent-danger-text"),
    bg: () => blend(rgb("--accent-danger"), rgb("--surface-default"), 0.1),
    min: TEXT,
  },
  { name: "botón destructivo (on-danger sobre danger-solid)", fg: () => rgb("--on-accent-danger"), bg: () => rgb("--accent-danger-solid"), min: TEXT },
  { name: "borde de campo contra la tarjeta", fg: () => rgb("--field-border"), bg: () => rgb("--surface-default"), min: NON_TEXT },
  { name: "borde de campo contra el relleno del campo", fg: () => rgb("--field-border"), bg: () => rgb("--surface-elevated"), min: NON_TEXT },
  { name: "anillo de foco contra la tarjeta", fg: () => rgb("--focus-ring"), bg: () => rgb("--surface-default"), min: NON_TEXT },
  { name: "anillo de foco contra el relleno del campo", fg: () => rgb("--focus-ring"), bg: () => rgb("--surface-elevated"), min: NON_TEXT },
  { name: "borde de error del campo contra el relleno", fg: () => rgb("--accent-danger"), bg: () => rgb("--surface-elevated"), min: NON_TEXT },
];

describe("ACC-4 — contraste de error, campo y foco", () => {
  it.each(PAIRS)("$name ≥ $min:1", ({ fg, bg, min }) => {
    expect(contrastRatio(fg(), bg())).toBeGreaterThanOrEqual(min);
  });

  it("el texto de error y el botón destructivo mantienen el matiz del rojo (25)", () => {
    expect(resolveToken("--accent-danger-text")).toMatch(/^oklch\([\d.]+% [\d.]+ 25\)$/);
    expect(resolveToken("--accent-danger-solid")).toMatch(/^oklch\([\d.]+% [\d.]+ 25\)$/);
  });

  it("ConfirmModal pinta el botón destructivo con el par accesible", () => {
    const src = readFileSync(resolve(ROOT, "src/components/ui/ConfirmModal.tsx"), "utf8");
    expect(src).toMatch(/bg-accent-danger-solid/);
    expect(src).toMatch(/text-on-accent-danger/);
    expect(src).not.toMatch(/bg-accent-danger text-on-accent-positive/);
  });
});

describe("ACC-9 — iniciales legibles en los 8 colores de avatar", () => {
  it("la paleta tiene 8 colores, todos en OKLCH", () => {
    expect(AVATAR_COLORS).toHaveLength(8);
    for (const c of AVATAR_COLORS) {
      expect(c.value).toMatch(/^oklch\(/);
      expect(c.on).toMatch(/^oklch\(/);
    }
  });

  it.each(AVATAR_COLORS.map((c) => [c.name, c] as const))("%s ≥ 4,5:1", (_name, c) => {
    expect(contrastRatio(rgb(c.on), rgb(c.value))).toBeGreaterThanOrEqual(TEXT);
  });
});

/* ─── Álbum de cromos: noche (app) y papel (páginas públicas) ─── */
function paper(token: string): Rgb {
  const out = toSrgb(resolvePaperToken(token));
  if (!out) throw new Error(`No se puede convertir ${token}`);
  return out;
}

const FORMATS = ["movie", "tv", "anime", "manga", "game", "book", "comic"];

describe("Álbum — noche (la app)", () => {
  const NIGHT: Array<[string, string, string, number]> = [
    ["texto principal sobre el fondo", "--text-primary", "--surface-base", TEXT],
    ["texto secundario sobre la superficie elevada", "--text-secondary", "--surface-elevated", TEXT],
    ["texto terciario sobre la superficie elevada", "--text-tertiary", "--surface-elevated", TEXT],
    ["texto del botón primario sobre el rosa", "--on-accent-pink", "--accent-pink", TEXT],
    ["texto del primario sobre el rosa de hover", "--on-accent-pink", "--accent-pink-hover", TEXT],
    ["texto del secundario sobre su relleno", "--button-secondary-fg", "--button-secondary-bg", TEXT],
    ["rosa (forma del botón) contra el fondo", "--accent-pink", "--surface-base", NON_TEXT],
    ["banda amarilla de orientación contra el fondo", "--wayfinding", "--surface-base", NON_TEXT],
    ["foco amarillo contra el fondo", "--focus-ring", "--surface-base", NON_TEXT],
    ["chip elegido (fondo sobre texto)", "--surface-base", "--text-primary", TEXT],
  ];
  it.each(NIGHT)("%s ≥ %3$s", (_n, fg, bg, min) => {
    expect(contrastRatio(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(min);
  });

  it("el fondo es azul marino, no negro ni violeta", () => {
    expect(resolveToken("--surface-base")).toMatch(/^oklch\((\d+(?:\.\d+)?)% [\d.]+ 262\.5\)$/);
    const l = Number(/oklch\(([\d.]+)%/.exec(resolveToken("--surface-base"))![1]);
    expect(l).toBeGreaterThanOrEqual(18);
    for (const t of ["--accent-purple", "--surface-default", "--surface-elevated"]) {
      const h = Number(/ ([\d.]+)\)$/.exec(resolveToken(t))![1]);
      expect(h < 270 || h > 330).toBe(true);
    }
  });

  it.each(FORMATS)("formato %s: texto apto ≥ 4,5:1 sobre el fondo y la superficie elevada", (f) => {
    for (const bg of ["--surface-base", "--surface-elevated"]) {
      expect(contrastRatio(rgb(`--format-${f}-ink`), rgb(bg))).toBeGreaterThanOrEqual(TEXT);
    }
    expect(contrastRatio(rgb(`--format-${f}`), rgb("--surface-base"))).toBeGreaterThanOrEqual(NON_TEXT);
  });
});

describe("Álbum — papel (páginas públicas, .theme-paper)", () => {
  const PAPER: Array<[string, string, string, number]> = [
    ["tinta marina sobre blanco", "--text-primary", "--surface-base", TEXT],
    ["texto secundario sobre blanco", "--text-secondary", "--surface-base", TEXT],
    ["texto terciario sobre la superficie elevada", "--text-tertiary", "--surface-elevated", TEXT],
    ["texto del botón primario sobre el rosa", "--on-accent-pink", "--accent-pink", TEXT],
    ["secundario: marino sobre blanco", "--button-secondary-fg", "--button-secondary-bg", TEXT],
    ["rosa (forma del botón) contra el blanco", "--accent-pink", "--surface-base", NON_TEXT],
    ["foco marino contra el blanco", "--focus-ring", "--surface-base", NON_TEXT],
    ["borde de campo contra el blanco", "--field-border", "--surface-base", NON_TEXT],
    ["texto de error sobre blanco", "--accent-danger-text", "--surface-base", TEXT],
    ["marino sobre el campo cian", "--album-navy", "--album-cyan", TEXT],
    ["marino sobre el campo amarillo", "--album-navy", "--album-yellow", TEXT],
  ];
  it.each(PAPER)("%s ≥ %3$s", (_n, fg, bg, min) => {
    expect(contrastRatio(paper(fg), paper(bg))).toBeGreaterThanOrEqual(min);
  });

  it.each(FORMATS)("formato %s: texto apto ≥ 4,5:1 sobre el papel y su superficie elevada", (f) => {
    for (const bg of ["--surface-base", "--surface-elevated"]) {
      expect(contrastRatio(paper(`--format-${f}-ink`), paper(bg))).toBeGreaterThanOrEqual(TEXT);
    }
  });
});

