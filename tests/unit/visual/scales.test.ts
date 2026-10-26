/**
 * @vitest-environment node
 *
 * F-30 · DIS-7, DIS-8 y DIS-12: radios, tipos, sombras y retícula cerrados.
 *
 * - ≤ 4 radios distintos (sin contar la píldora) y fuera los nombres viejos
 *   (`rounded-card`, `-18`, `-24`, `-3xl`, `bento-lg`);
 * - 0 `text-[Npx]`, `rounded-[…]` y `shadow-[…]` en `src`;
 * - los alias en retirada solo en los archivos de otros frentes que aún los
 *   usan (Descubrir, Ajustes), para que nadie más vuelva a ellos;
 * - la retícula `page-grid` existe y la usan las cabeceras.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import config from "../../../tailwind.config";

const ROOT = resolve(__dirname, "../../..");
/** Archivos de otros frentes en esta oleada (F-32 Descubrir, F-33 Ajustes). */
const FOREIGN = [/^src\/app\/\[locale\]\/\(app\)\/discover\//, /^src\/app\/\[locale\]\/\(app\)\/settings\/SettingsForm\.tsx$/];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Código sin comentarios (la documentación cita clases retiradas). */
const FILES = walk(join(ROOT, "src")).map((file) => ({
  rel: relative(ROOT, file),
  code: readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, " "),
}));

function offenders(re: RegExp, { allowForeign = false } = {}) {
  return FILES.filter((f) => !(allowForeign && FOREIGN.some((p) => p.test(f.rel))))
    .flatMap((f) => Array.from(f.code.matchAll(re), (m) => `${f.rel}: ${m[0]}`));
}

const B = "(?<![\\w-])";

describe("DIS-7 · radios", () => {
  const radii = config.theme!.borderRadius as Record<string, string>;

  it("≤ 4 radios distintos además de la píldora y el 0", () => {
    const values = new Set(Object.values(radii).filter((v) => v !== "9999px" && v !== "0px"));
    expect(Array.from(values).sort()).toEqual(["16px", "20px", "32px", "8px"]);
  });

  it("0 usos de rounded-card / -18 / -24 / -3xl / bento-lg (salvo archivos ajenos)", () => {
    expect(offenders(new RegExp(`${B}rounded(-[a-z]{1,2})?-(card|18|24|3xl|bento-lg)(?![\\w-])`, "g"), { allowForeign: true })).toEqual([]);
  });

  it("los alias en retirada (`rounded`, `-xl`, `-20`, `-card`) solo en archivos ajenos", () => {
    expect(
      offenders(new RegExp(`${B}rounded(-[a-z]{1,2})?(-(xl|20|card))?(?=["'\`\\s}])`, "g"), { allowForeign: true }).filter(
        (o) => !/rounded(-[a-z]{1,2})?-(lg|2xl|bento|bento-xl|full|pill|button|none)$/.test(o)
      )
    ).toEqual([]);
  });

  it("0 radios arbitrarios `rounded-[…]`", () => {
    expect(offenders(new RegExp(`${B}rounded(-[a-z]{1,2})?-\\[`, "g"), { allowForeign: true })).toEqual([]);
  });
});

describe("DIS-12 · escala tipográfica", () => {
  it("0 tamaños arbitrarios `text-[Npx]` / `text-[clamp…]` (salvo archivos ajenos)", () => {
    expect(offenders(new RegExp(`${B}text-\\[(\\d|clamp)`, "g"), { allowForeign: true })).toEqual([]);
  });

  it("la escala es cerrada (sustituye a la de Tailwind) y va de 12 a 96 px", () => {
    const sizes = config.theme!.fontSize as Record<string, [string, unknown]>;
    expect(Object.keys(sizes)).toEqual([
      "xs", "meta", "sm", "body", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "display",
    ]);
    expect(sizes.xs[0]).toBe("12px");
    expect(sizes["8xl"][0]).toBe("96px");
  });
});

describe("sombras del set cerrado", () => {
  it("solo hard, hard-sm, sticker y soft", () => {
    expect(Object.keys(config.theme!.boxShadow as object).sort()).toEqual(["hard", "hard-sm", "none", "soft", "sticker"]);
  });

  it("0 sombras arbitrarias `shadow-[…]`", () => {
    expect(offenders(new RegExp(`${B}shadow-\\[`, "g"))).toEqual([]);
  });
});

describe("DIS-8 · retícula única", () => {
  it("las cabeceras pública y con sesión usan `page-grid`", () => {
    for (const rel of ["src/components/layout/Header.tsx", "src/components/layout/AuthHeader.tsx"]) {
      expect(FILES.find((f) => f.rel === rel)!.code).toMatch(/className="page-grid\b/);
    }
  });

  it("ningún contenedor de página centra su propio ancho (`max-w-* mx-auto px-*`)", () => {
    const re = /className=["'`][^"'`]*\bmx-auto\b[^"'`]*["'`]/g;
    const centred = offenders(re, { allowForeign: true }).filter(
      (o) => /\bmax-w-(\dxl|xl|\[\d+px\])/.test(o) && /\bpx-\d/.test(o)
    );
    expect(centred).toEqual([]);
  });
});
