/**
 * Tests unitarios — el foco es el del sistema, no el verde de estados.
 *
 * Historia: el canvas F0 tenía UNA sola sombra de foco (pink) y el código
 * enfocaba en lime en dos docenas de sitios (E-LOGIN-F0). Con el «Álbum de
 * cromos» el foco es el token `--focus-ring`: contorno de 2 px AMARILLO sobre
 * el fondo de noche y MARINO en las páginas de papel (`.theme-paper`), con
 * separación. Los componentes compartidos lo usan como contorno
 * (`outline-focus-ring`), no como sombra (`forced-colors` la borra).
 *
 * Es un guard de FUENTE a propósito: el fallo es "alguien vuelve a escribir
 * `focus:ring-accent-positive` en un componente nuevo", y eso no lo caza ningún
 * test de render porque jsdom no aplica la hoja de Tailwind.
 *
 * `accent-positive` NO desaparece: sigue siendo el verde semántico de ESTADOS.
 * Por eso el patrón exige el prefijo `focus:` / `focus-visible:`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { resolveToken } from "./css-tokens";
import { PAPER_TOKENS } from "./css-tokens";

const SRC = resolve(__dirname, "../../../src");

/** `focus:` o `focus-visible:` seguido de ring/border en el verde de estados. */
const LIME_FOCUS = /focus(?:-visible)?:(?:ring|border)-accent-positive/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

describe("foco del sistema", () => {
  let offenders: string[];

  beforeAll(() => {
    offenders = walk(SRC).filter((file) => LIME_FOCUS.test(readFileSync(file, "utf-8")));
  });

  it("ningún archivo de src enfoca con el verde de estados", () => {
    expect(offenders).toEqual([]);
  });

  it("el foco es amarillo de noche y marino en papel", () => {
    expect(resolveToken("--focus-ring")).toBe(resolveToken("--album-yellow"));
    expect(PAPER_TOKENS["--focus-ring"]).toBe("var(--album-navy)");
  });

  it.each([
    "components/ui/KButton.tsx",
    "components/ui/FilterChip.tsx",
    "components/ui/SegmentedControl.tsx",
    "components/ui/TabButton.tsx",
    "components/media/MediaCard.tsx",
    "components/layout/nav-shared.tsx",
  ])("%s enfoca con el contorno del sistema", (file) => {
    const code = readFileSync(join(SRC, file), "utf-8");
    expect(code).toMatch(/focus-visible:outline-focus-ring/);
    expect(code).not.toMatch(/focus-visible:ring-accent-pink/);
  });
});
