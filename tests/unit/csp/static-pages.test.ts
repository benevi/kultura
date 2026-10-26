/**
 * F-22 (D-02) — que las páginas cacheables sigan pudiendo pintarse sin
 * petición. Basta una llamada a `headers()`/`cookies()` en el layout común o en
 * la 404 raíz (Next la pinta en el árbol de todas las páginas) para que todas
 * vuelvan a ser dinámicas y salgan del CDN, sin que nada falle: este test es
 * la alarma. El comportamiento real se comprueba en el build (`●` en la tabla
 * de rutas) y con scripts/check-edge-cache.sh en producción.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
/** Código sin comentarios (los comentarios explican por qué no hay `headers()`). */
const src = (p: string) =>
  readFileSync(resolve(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const DYNAMIC_API = /from ["']next\/headers["']|\bcookies\(\)|\bheaders\(\)|\bconnection\(\)|\bdraftMode\(\)/;

describe("archivos que envuelven a todas las páginas", () => {
  it.each(["src/app/[locale]/layout.tsx", "src/app/not-found.tsx", "src/app/layout.tsx"])(
    "%s no usa APIs dinámicas",
    (file) => {
      expect(src(file)).not.toMatch(DYNAMIC_API);
    },
  );

  it("el layout fija el idioma de la URL (setRequestLocale) y lee los mensajes con él", () => {
    const layout = src("src/app/[locale]/layout.tsx");
    expect(layout).toMatch(/setRequestLocale\(locale\)/);
    expect(layout).toMatch(/getMessages\(\{ locale \}\)/);
  });
});

describe("páginas cacheables", () => {
  const BUILD_TIME = [
    "src/app/[locale]/page.tsx",
    "src/app/[locale]/privacy/page.tsx",
    "src/app/[locale]/terms/page.tsx",
    "src/app/[locale]/legal/page.tsx",
    "src/app/[locale]/accessibility/page.tsx",
    "src/app/[locale]/offline/page.tsx",
  ];
  const ON_DEMAND = [
    "src/app/[locale]/best/page.tsx",
    "src/app/[locale]/best/[format]/page.tsx",
    "src/app/[locale]/best/[format]/[year]/page.tsx",
  ];

  it.each([...BUILD_TIME, ...ON_DEMAND])("%s: setRequestLocale, generateStaticParams y sin APIs dinámicas", (file) => {
    const page = src(file);
    expect(page).toMatch(/setRequestLocale\(/);
    expect(page).toMatch(/export function generateStaticParams\(/);
    expect(page).not.toMatch(DYNAMIC_API);
  });

  it.each(BUILD_TIME)("%s: se pinta en el build para cada idioma", (file) => {
    expect(src(file)).toMatch(/routing\.locales\.map\(\(locale\) => \(\{ locale \}\)\)/);
  });

  it.each(ON_DEMAND)("%s: ningún ranking en el build (no depende de los proveedores) y 24 h de vida", (file) => {
    const page = src(file);
    expect(page).toMatch(/export function generateStaticParams\(\) \{\s*return \[\];\s*\}/);
    expect(page).toMatch(/export const revalidate = 86400;/);
    expect(page).not.toMatch(/dynamicParams\s*=\s*false/);
  });
});

/**
 * F-22 (revisión #47): ni el `Link` de next-intl, ni `next/link`, ni
 * `useRouter` en nada que se pinte en una ruta cacheable. Navegan sin recargar
 * el documento: la página de destino (p. ej. /settings, con sesión) heredaría
 * la CSP fija `'unsafe-inline'` de la de origen en lugar de la suya con nonce
 * (reproducido: de /es/privacy a /es/settings se ejecutaba un `onerror`
 * inyectado). Un `<a>` carga el documento nuevo con su propia CSP.
 */
describe("grafo de imports de las rutas cacheables: solo enlaces <a>", () => {
  const SRC = resolve(ROOT, "src");
  const LOCALE = resolve(SRC, "app/[locale]");

  function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });
  }

  const FILES = new Map(walk(SRC).map((f) => [f, readFileSync(f, "utf8")]));
  const IMPORT_RE =
    /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm;

  function resolveImport(from: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = resolve(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
    else return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (FILES.has(c)) return c;
    }
    return null;
  }

  // Lo que pinta cualquier ruta cacheable: sus páginas (y lo que cuelga de
  // ellas), el layout común, las 404 y los límites de error.
  const ENTRIES = [
    resolve(SRC, "app/layout.tsx"),
    resolve(SRC, "app/not-found.tsx"),
    resolve(SRC, "app/global-error.tsx"),
    resolve(LOCALE, "layout.tsx"),
    resolve(LOCALE, "page.tsx"),
    resolve(LOCALE, "not-found.tsx"),
    resolve(LOCALE, "error.tsx"),
    ...["best", "privacy", "terms", "legal", "accessibility", "offline"].flatMap((d) => walk(resolve(LOCALE, d))),
  ].filter((f) => FILES.has(f));

  const graph = new Set<string>();
  const stack = [...ENTRIES];
  while (stack.length) {
    const file = stack.pop()!;
    if (graph.has(file)) continue;
    graph.add(file);
    for (const m of Array.from(FILES.get(file)!.matchAll(IMPORT_RE))) {
      const target = resolveImport(file, m[1] ?? m[2] ?? m[3]);
      if (target && !graph.has(target)) stack.push(target);
    }
  }
  const rel = (f: string) => f.slice(ROOT.length + 1);

  it("cubre las seis familias de rutas cacheables (/offline incluida), la cabecera y el pie", () => {
    const files = Array.from(graph).map(rel);
    for (const dir of ["best", "privacy", "terms", "legal", "accessibility", "offline"]) {
      expect(files.some((f) => f.startsWith(`src/app/[locale]/${dir}/`))).toBe(true);
    }
    expect(files).toEqual(
      expect.arrayContaining([
        "src/components/layout/Header.tsx",
        "src/components/layout/Footer.tsx",
        "src/components/legal/LegalDocument.tsx",
        "src/components/best/ShareRanking.tsx",
      ]),
    );
  });

  it("ningún módulo importa @/i18n/navigation ni next/link", () => {
    const offenders = Array.from(graph)
      .filter((f) => /from\s*['"](@\/i18n\/navigation|next\/link)['"]/.test(src(rel(f))))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("ningún módulo navega con el router de la app (useRouter / router.push)", () => {
    const offenders = Array.from(graph)
      .filter((f) => /\buseRouter\b|\brouter\.(push|replace|prefetch)\(/.test(src(rel(f))))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
