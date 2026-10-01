/**
 * Tests unitarios — el anillo de foco es PINK, no lime (E-LOGIN-F0).
 *
 * El canvas tiene UNA sola sombra de foco en sus 17 pantallas: el anillo pink
 * (`0 0 0 6px pink/0.25`). El verde que había antes en el código no salía de
 * ningún artboard. `KInput` ya se migró con el acabado del Login, pero el resto
 * de la app seguía enfocando en lime en dos docenas de sitios.
 *
 * Esto es un guard de FUENTE a propósito: el fallo es "alguien vuelve a escribir
 * `focus:ring-accent-positive` en un componente nuevo", y eso no lo caza ningún
 * test de render porque jsdom no aplica la hoja de Tailwind. Lo que sí se puede
 * fijar es que la cadena no vuelva al árbol.
 *
 * `accent-positive` NO desaparece (E-BOTON-PINK): sigue siendo el verde
 * semántico de ESTADOS. Por eso el patrón exige el prefijo `focus:` /
 * `focus-visible:` y un `ring-2 ring-accent-positive` de "seleccionado"
 * (AvatarIconPicker, SettingsForm) sigue siendo legítimo.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

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

describe("E-LOGIN-F0 — el foco se pinta en pink", () => {
  let offenders: string[];

  beforeAll(() => {
    offenders = walk(SRC).filter((file) =>
      LIME_FOCUS.test(readFileSync(file, "utf-8"))
    );
  });

  it("ningún archivo de src enfoca con el verde de estados", () => {
    expect(offenders).toEqual([]);
  });

  it("el anillo pink sí está en uso (el guard no pasa por estar todo vacío)", () => {
    const usesPink = walk(SRC).some((file) =>
      /focus(?:-visible)?:(?:ring|border)-accent-pink/.test(
        readFileSync(file, "utf-8")
      )
    );
    expect(usesPink).toBe(true);
  });
});
