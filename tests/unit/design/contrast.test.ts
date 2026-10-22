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
import { ROOT, resolveToken } from "./css-tokens";

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
