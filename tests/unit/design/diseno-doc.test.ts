/**
 * @vitest-environment node
 *
 * Tests unitarios — `DISENO.md` describe el código (D-19, DIS-2, DIS-11).
 *
 * El documento usaba los nombres de token del canvas (`--pink`, `--lime`…)
 * mientras `globals.css` los define como `--accent-*`. Quien copió del
 * documento (`FeatureGrid`) pintó avatares vacíos, porque `var(--pink)` no
 * existía. Y la tabla de hex «aproximados» estaba mal en 5 de 12 filas.
 *
 * Aquí se fija:
 * 1. cada fila de la tabla de referencia de DISENO.md tiene el OKLCH real de
 *    `globals.css` y un hex que es su conversión exacta (±1 por canal);
 * 2. cada token del bloque de código de DISENO.md existe en `:root` con el
 *    mismo valor (copiar del documento funciona);
 * 3. cada `var(--x)` que usa `src` está definido (salvo variables de
 *    tiempo de ejecución conocidas).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { parseHex, toSrgb } from "@/lib/design/color";
import { ROOT, RAW_TOKENS, resolveToken } from "./css-tokens";

const DOC = readFileSync(resolve(ROOT, "DISENO.md"), "utf8");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Filas `| `--token` | … | oklch(…) | #hex | … |` de la tabla de referencia. */
const ROWS = Array.from(
  DOC.matchAll(/^\|\s*`(--[\w-]+)`\s*\|(?:[^|\n]*\|)??\s*`?(oklch\([^)]*\))`?\s*\|\s*`?(#[0-9a-fA-F]{6})`?\s*\|/gm)
).map((m) => ({ name: m[1], oklch: m[2], hex: m[3] }));

describe("DISENO.md — tabla de referencia OKLCH → hex", () => {
  it("la tabla cubre superficies, texto, acentos y estados", () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(20);
  });

  it.each(ROWS.map((r) => [r.name, r] as const))("%s: OKLCH igual al de globals.css y hex exacto", (_n, row) => {
    expect(norm(resolveToken(row.name))).toBe(norm(row.oklch));
    const real = toSrgb(row.oklch)!;
    const doc = parseHex(row.hex)!;
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(real[i] * 255 - doc[i] * 255)).toBeLessThanOrEqual(1);
    }
  });
});

describe("DISENO.md — los tokens documentados existen en :root", () => {
  const block = /## Tokens[\s\S]*?```css\n([\s\S]*?)```/.exec(DOC)?.[1] ?? "";
  const documented = Array.from(block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)).map((m) => [m[1], m[2].trim()] as const);

  it("el bloque de tokens no está vacío", () => {
    expect(documented.length).toBeGreaterThanOrEqual(12);
  });

  it.each(documented)("%s está definido con el mismo valor", (name, value) => {
    expect(RAW_TOKENS[name]).toBeDefined();
    const expected = /^var\((--[\w-]+)\)$/.exec(value);
    expect(norm(resolveToken(name))).toBe(norm(expected ? resolveToken(expected[1]) : value));
  });
});

describe("src — ningún var(--x) apunta a un token inexistente", () => {
  /** Variables que se definen en tiempo de ejecución, no en :root. */
  const RUNTIME = [/^--tw-/, /^--font-(display|body)$/, /^--radix-/, /^--p$/, /^--x$/];

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
    });
  }

  it("todas las referencias están definidas", () => {
    const missing: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      for (const m of Array.from(readFileSync(file, "utf8").matchAll(/var\((--[\w-]+)/g))) {
        const name = m[1];
        if (RUNTIME.some((re) => re.test(name))) continue;
        if (RAW_TOKENS[name] === undefined) missing.push(`${file.replace(ROOT + "/", "")}: ${name}`);
      }
    }
    expect(Array.from(new Set(missing))).toEqual([]);
  });
});
