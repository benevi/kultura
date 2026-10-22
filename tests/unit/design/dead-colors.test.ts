/**
 * @vitest-environment node
 *
 * Tests unitarios — ninguna clase de color de `src` se queda sin regla.
 *
 * Complementa a `tailwind-alpha.test.ts`: aquel mira las clases con `/<alfa>`;
 * este, las clases de borde/fondo/anillo/contorno con un nombre de color que
 * el tema no tiene (`border-stroke` antes de tener alias,
 * `ring-offset-background` o `ring-ring` heredados de shadcn). Una clase así
 * no falla en ningún sitio: simplemente no pinta, y el preflight deja el
 * borde gris #e5e7eb o el anillo azul por defecto.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "../../../tailwind.config";

const ROOT = resolve(__dirname, "../../..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const escapeClass = (cls: string) => cls.replace(/[/:.[\]%#()]/g, (c) => `\\${c}`);

let css = "";
beforeAll(async () => {
  const result = await postcss([
    tailwindcss({ ...config, content: (config.content as string[]).map((p) => join(ROOT, p)) }),
  ]).process("@tailwind base; @tailwind components; @tailwind utilities;", { from: undefined });
  css = result.css;
}, 60_000);

describe("clases de color sin regla", () => {
  it("un border sin color usa el borde del sistema, no el gris #e5e7eb de Tailwind", () => {
    expect(css).not.toMatch(/#e5e7eb/i);
    expect(css).toMatch(/border-color: color-mix\(in oklch, var\(--surface-border\)/);
  });

  it("toda clase border/bg/ring/outline/divide con nombre de color usada en src genera regla", () => {
    // Solo dentro de atributos className/class y de cadenas de clases: se
    // buscan tokens sueltos entre comillas, espacios o backticks.
    const re =
      /(?<=["'`\s])((?:[a-z0-9-]+:)*)((?:border(?:-[trblxy])?|bg|ring|ring-offset|outline|divide|from|via|to|text|placeholder|fill|stroke)-[a-z][a-z0-9-]*[a-z0-9](?:\/\d{1,3})?)(?=["'`\s])/g;
    const used = new Map<string, string>();
    for (const file of walk(join(ROOT, "src"))) {
      // Sin comentarios: la documentación cita clases que ya no existen.
      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|\s)\/\/.*$/gm, " ");
      for (const m of Array.from(src.matchAll(re))) used.set(m[1] + m[2], file.replace(ROOT + "/", ""));
    }
    const missing = Array.from(used.entries())
      .filter(([cls]) => !css.includes(`.${escapeClass(cls)}`))
      .map(([cls, file]) => `${file}: ${cls}`);
    expect(missing).toEqual([]);
  });
});
