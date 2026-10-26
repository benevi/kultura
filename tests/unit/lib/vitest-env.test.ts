// @vitest-environment node
/**
 * COD-10: los `.ts` corren en `node` y solo los que necesitan DOM lo piden con
 * `// @vitest-environment jsdom` en la primera línea. Antes una lista en
 * `vitest.config.ts` los mandaba a jsdom a escondidas; ahora no hay lista y
 * este test impide que un `.ts` use `document`/`window` sin declararlo (en
 * la suite completa fallaría según el orden de carga, no siempre).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const UNIT = join(ROOT, "tests", "unit");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(test|spec)\.ts$/.test(e.name) ? [full] : [];
  });
}

/** Código sin comentarios ni cadenas (un `document.cookie` dentro de un texto no cuenta). */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

describe("entorno de los tests .ts", () => {
  it("vitest.config.ts ya no manda .ts a jsdom por lista", () => {
    expect(readFileSync(join(ROOT, "vitest.config.ts"), "utf8")).not.toMatch(/DOM_TS_PENDING/);
  });

  it("tope de 5 s por defecto; solo los archivos lentos conocidos lo suben", () => {
    expect(readFileSync(join(ROOT, "vitest.config.ts"), "utf8")).not.toMatch(/testTimeout\s*:/);
    const all = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? all(join(dir, e.name)) : /\.(test|spec)\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
      );
    const raised = all(UNIT)
      .filter((f) => /vi\.setConfig\(\{\s*testTimeout/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f))
      .sort();
    expect(raised).toEqual([
      "tests/unit/a11y/controls.test.tsx",
      "tests/unit/components/auth/register-form.test.tsx",
      "tests/unit/components/home/MediaRow.test.tsx",
      "tests/unit/components/ui/SegmentedControl.test.tsx",
      "tests/unit/components/ui/pagination.test.tsx",
      "tests/unit/legal/legal-documents.test.tsx",
    ]);
  });

  it("todo .ts que usa document/window/storage declara jsdom en su primera línea", () => {
    const missing = walk(UNIT)
      .filter((f) => /\b(document|window|localStorage|sessionStorage)\.\w/.test(code(readFileSync(f, "utf8"))))
      .filter((f) => readFileSync(f, "utf8").split("\n")[0].trim() !== "// @vitest-environment jsdom")
      .map((f) => relative(ROOT, f));
    expect(missing).toEqual([]);
  });
});
