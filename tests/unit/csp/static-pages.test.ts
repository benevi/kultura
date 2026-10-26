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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
