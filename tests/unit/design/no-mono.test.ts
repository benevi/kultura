/**
 * Tests unitarios — no hay tercera tipografía (E-SIN-MONO).
 *
 * El sistema de diseño son DOS familias: Bricolage Grotesque (display) y
 * Figtree (cuerpo). `layout.tsx` cargaba además JetBrains Mono y se usaba en
 * seis etiquetas `font-mono uppercase tracking-widest` sobre las filas de
 * filtros de Biblioteca y Descubrir; ningún artboard usa mono, y en el
 * artboard esas filas no llevan etiqueta, solo los chips.
 *
 * Guard de FUENTE, como `focus-ring.test.ts`: jsdom no aplica Tailwind, así
 * que lo único que se puede fijar es que la clase y la carga no vuelvan.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("E-SIN-MONO — solo Bricolage + Figtree", () => {
  it("ningún componente usa la clase font-mono", () => {
    const offenders = walk(SRC).filter((f) => /\bfont-mono\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("el layout no carga una fuente monoespaciada ni Tailwind la declara", () => {
    const layout = readFileSync(join(SRC, "app/[locale]/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/_Mono\b/);
    const tw = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
    expect(tw).not.toMatch(/--font-mono/);
  });
});
