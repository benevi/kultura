/**
 * @vitest-environment node
 *
 * Fase 8.4 — fuentes de «Sala» (`src/styles/sala/fonts*.css`, generadas por
 * `scripts/gen-sala-fonts.mjs`).
 *
 * - Cada archivo de `assets/fonts/` tiene exactamente un `@font-face`, y cada
 *   `@font-face` apunta a un archivo que existe (de Noto Sans KR solo están
 *   algunos trozos: una regla de más pediría un archivo que no hay).
 * - Cada regla lleva su `unicode-range`: sin él, el navegador bajaría los 211
 *   trozos CJK en vez de los pocos que usa un título.
 * - Orden de la biblia (§5): japonesa primero; en coreano, coreana primero.
 * - Nada de la app de hoy carga estas hojas: ni un byte más en sus pantallas.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative, resolve, sep } from "path";
import { SALA_FAMILY } from "@/lib/design/sala-tokens";

const ROOT = resolve(__dirname, "../../..");
const SHEETS_DIR = join(ROOT, "src/styles/sala");
const FONTS_DIR = join(ROOT, "assets/fonts");

interface Face {
  sheet: string;
  family: string;
  /** Ruta del archivo, relativa a la raíz del repo. */
  file: string;
  ranges: Array<[number, number]>;
  css: string;
}

function parseRanges(value: string): Array<[number, number]> {
  return value.split(",").map((part) => {
    const m = /^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i.exec(part.trim());
    if (!m) throw new Error(`unicode-range ilegible: ${part}`);
    return [parseInt(m[1], 16), parseInt(m[2] ?? m[1], 16)];
  });
}

function faces(sheet: string): Face[] {
  const css = readFileSync(join(SHEETS_DIR, sheet), "utf8");
  return css
    .split("@font-face")
    .slice(1)
    .map((block) => {
      const prop = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1].trim() ?? "";
      const url = /url\("([^"]+)"\)/.exec(block)?.[1] ?? "";
      return {
        sheet,
        family: prop("font-family").replace(/"/g, ""),
        file: relative(ROOT, resolve(SHEETS_DIR, url)).split(sep).join("/"),
        ranges: prop("unicode-range") ? parseRanges(prop("unicode-range")) : [],
        css: block,
      };
    });
}

const SHEETS = { latin: faces("fonts.css"), jp: faces("fonts-jp.css"), kr: faces("fonts-kr.css") };
const ALL = [...SHEETS.latin, ...SHEETS.jp, ...SHEETS.kr];

const covers = (list: Face[], family: string, char: string) =>
  list.some((f) => f.family === family && f.ranges.some(([lo, hi]) => char.codePointAt(0)! >= lo && char.codePointAt(0)! <= hi));

function woff2(dir: string): string[] {
  return readdirSync(join(FONTS_DIR, dir))
    .filter((f) => f.endsWith(".woff2"))
    .map((f) => `assets/fonts/${dir}/${f}`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("@font-face de «Sala»", () => {
  it("cada hoja lleva las familias que le tocan", () => {
    expect(new Set(SHEETS.latin.map((f) => f.family))).toEqual(new Set([SALA_FAMILY.display, SALA_FAMILY.text]));
    expect(new Set(SHEETS.jp.map((f) => f.family))).toEqual(new Set([SALA_FAMILY.jp]));
    expect(new Set(SHEETS.kr.map((f) => f.family))).toEqual(new Set([SALA_FAMILY.kr]));
  });

  it("cada regla apunta a un archivo que existe", () => {
    expect(ALL.filter((f) => !existsSync(join(ROOT, f.file))).map((f) => f.file)).toEqual([]);
  });

  it("cada archivo de assets/fonts tiene exactamente una regla", () => {
    const files = ["anybody", "instrument-sans", "noto-sans-jp", "noto-sans-kr"].flatMap(woff2).sort();
    expect(ALL.map((f) => f.file).sort()).toEqual(files);
    expect(SHEETS.jp).toHaveLength(120);
    expect(SHEETS.kr).toHaveLength(woff2("noto-sans-kr").length);
  });

  it("todas llevan unicode-range, font-display: swap y formato woff2", () => {
    for (const f of ALL) {
      expect(f.ranges.length, f.file).toBeGreaterThan(0);
      expect(f.css, f.file).toMatch(/font-display:\s*swap;/);
      expect(f.css, f.file).toMatch(/format\("woff2"\)/);
    }
  });

  it("Anybody declara sus dos ejes: peso 100–900 y anchura 50–150 %", () => {
    for (const f of SHEETS.latin.filter((x) => x.family === SALA_FAMILY.display)) {
      expect(f.css).toMatch(/font-weight:\s*100 900;/);
      expect(f.css).toMatch(/font-stretch:\s*50% 150%;/);
    }
  });

  it("dentro de una familia ningún carácter está en dos archivos (los trozos CJK no se pisan)", () => {
    for (const family of [SALA_FAMILY.jp, SALA_FAMILY.kr]) {
      const seen = new Map<number, string>();
      const clashes: string[] = [];
      for (const f of ALL.filter((x) => x.family === family)) {
        for (const [lo, hi] of f.ranges) {
          for (let cp = lo; cp <= hi; cp++) {
            const other = seen.get(cp);
            if (other && other !== f.file) clashes.push(`U+${cp.toString(16)}: ${other} y ${f.file}`);
            seen.set(cp, f.file);
          }
        }
      }
      expect(clashes.slice(0, 3), family).toEqual([]);
    }
  });

  it("cubren lo que la biblia pone de ejemplo", () => {
    for (const ch of "Parásitos ¿ñ? Kieślowski") {
      expect(covers(SHEETS.latin, SALA_FAMILY.display, ch), `rótulo: ${ch}`).toBe(true);
      expect(covers(SHEETS.latin, SALA_FAMILY.text, ch), `texto: ${ch}`).toBe(true);
    }
    for (const ch of "千と千尋の神隠し" + "ベルセルク") expect(covers(SHEETS.jp, SALA_FAMILY.jp, ch), ch).toBe(true);
    for (const ch of "기생충") {
      expect(covers(SHEETS.kr, SALA_FAMILY.kr, ch), ch).toBe(true);
      // El hangul no está en la japonesa: aunque vaya primero, cae en la coreana.
      expect(covers(SHEETS.jp, SALA_FAMILY.jp, ch), ch).toBe(false);
    }
  });
});

describe("orden de las fuentes (biblia §5)", () => {
  const tokens = readFileSync(join(SHEETS_DIR, "tokens.css"), "utf8");
  const stacks = (selector: string) => {
    const body = new RegExp(`${selector.replace(/[()[\]]/g, "\\$&")} \\{([^}]*)\\}`).exec(tokens)?.[1] ?? "";
    return Array.from(body.matchAll(/--sala-font-[\w-]+:\s*([^;]+);/g), (m) => m[1]);
  };

  it("por defecto, la japonesa va antes que la coreana", () => {
    const found = stacks(":root");
    expect(found).toHaveLength(2);
    for (const s of found) expect(s.indexOf(SALA_FAMILY.jp)).toBeLessThan(s.indexOf(SALA_FAMILY.kr));
  });

  it("en coreano, la coreana va antes que la japonesa", () => {
    const found = stacks(":lang(ko)");
    expect(found).toHaveLength(2);
    for (const s of found) {
      expect(s.indexOf(SALA_FAMILY.kr)).toBeGreaterThan(0);
      expect(s.indexOf(SALA_FAMILY.kr)).toBeLessThan(s.indexOf(SALA_FAMILY.jp));
    }
  });

  it("otro idioma marcado dentro de un texto coreano vuelve al orden por defecto", () => {
    // `<div lang="ko"><p lang="ja">`: sin esta regla el párrafo heredaría la pila coreana.
    expect(stacks("[lang]:not(:lang(ko))")).toEqual(stacks(":root"));
    expect(stacks("[lang]:not(:lang(ko))")).toHaveLength(2);
  });

  it("la fuente latina va siempre la primera", () => {
    const all = [...stacks(":root"), ...stacks(":lang(ko)")];
    expect(all.filter((s) => s.startsWith(`"${SALA_FAMILY.display}"`))).toHaveLength(2);
    expect(all.filter((s) => s.startsWith(`"${SALA_FAMILY.text}"`))).toHaveLength(2);
  });
});

describe("las pantallas de hoy solo descargan «Sala» donde ya la usan", () => {
  it("solo Storybook, las piezas de «Sala», el estado de error de los error.tsx y la sala de la ficha importan las hojas de src/styles/sala", () => {
    const importers = walk(join(ROOT, "src"))
      .filter((f) => /\.(tsx?|css|mdx?)$/.test(f) && dirname(f) !== SHEETS_DIR)
      .filter((f) => /styles\/sala\//.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).split(sep).join("/"))
      // Comentarios que nombran la ruta no cuentan: solo quien la importa.
      .filter((f) => /(import|@import|require)[^\n]*styles\/sala\//.test(readFileSync(join(ROOT, f), "utf8")));
    // - `SalaScriptFonts` pide las hojas de japonés y coreano cuando hace falta.
    // - `ErrorState` (`src/components/layout`, fase 8.4, C11) es la primera pieza
    //   de la app que importa «Sala»: la usan todos los error.tsx y trae los
    //   tokens y las fuentes latinas mientras el layout no los cargue.
    // - `SalaFichaStyles` (fase 8.5, F1): la sala de la ficha, por `next/dynamic`
    //   y solo con la bandera `SALA_FICHA` encendida.
    expect(importers.sort()).toEqual([
      "src/components/layout/ErrorState.tsx",
      "src/components/media/sala/SalaFichaStyles.tsx",
      "src/components/sala/SalaScriptFonts.tsx",
    ]);
  });
});
