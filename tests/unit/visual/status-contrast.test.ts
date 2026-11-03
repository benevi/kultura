/**
 * @vitest-environment node
 *
 * F-30 · Contraste del estado de la biblioteca en la ficha. Antes eran
 * pastillas de color al 20 % (`statusClasses` de `LibraryAction.tsx`), con el
 * azul y el rojo por debajo de 4,5:1 hasta F-30. Con el álbum, el estado es
 * la `StatusBand`: texto en tinta principal (y la fecha en terciaria) sobre la
 * superficie elevada, igual de noche que en papel, sin colores de estado que
 * dependan de la mezcla. Aquí se comprueba que el estado sale por la banda y
 * que sus dos pares pasan 4,5:1 en los dos temas.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrastRatio, toSrgb, type Rgb } from "@/lib/design/color";
import { ROOT, resolvePaperToken, resolveToken } from "../design/css-tokens";

const night = (token: string): Rgb => toSrgb(resolveToken(token))!;
const paper = (token: string): Rgb => toSrgb(resolvePaperToken(token))!;
const read = (file: string) => readFileSync(resolve(ROOT, file), "utf8");

describe("estado de la biblioteca en la ficha (LibraryAction)", () => {
  it("sale por la StatusBand, sin pastillas de color al 20 %", () => {
    const code = read("src/components/library/LibraryAction.tsx");
    expect(code).toContain("<StatusBand");
    expect(code).not.toMatch(/const statusClasses/);
    expect(code).not.toMatch(/bg-accent-\w+\/20/);
  });

  it("la banda pinta el estado en tinta principal y la fecha en terciaria sobre la superficie elevada", () => {
    const band = read("src/components/album/StatusBand.tsx");
    expect(band).toContain("bg-surface-elevated");
    expect(band).toContain("text-text-primary");
    expect(band).toContain("text-text-tertiary");
  });

  it.each([
    ["noche", night],
    ["papel", paper],
  ] as const)("%s: estado y fecha ≥ 4,5:1", (_theme, rgb) => {
    const bg = rgb("--surface-elevated");
    expect(contrastRatio(rgb("--text-primary"), bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(rgb("--text-tertiary"), bg)).toBeGreaterThanOrEqual(4.5);
  });
});
