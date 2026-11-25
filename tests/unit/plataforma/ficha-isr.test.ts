/**
 * FICHA_ISR — reglas de la ficha cacheable (src/lib/ficha-isr.ts) y de su
 * página: sin APIs dinámicas (o dejaría de poder guardarse) y con su caché.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  fichaIsrPath,
  isAnonymousForFichaIsr,
  isFichaIsrInternalPath,
  isRouterFetchFromFicha,
} from "@/lib/ficha-isr";
import { SALA_TEST_COOKIE } from "@/lib/flags/sala";

const ROOT = resolve(__dirname, "../../..");
const src = (p: string) =>
  readFileSync(resolve(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const DYNAMIC_API = /from ["']next\/headers["']|\bcookies\(\)|\bheaders\(\)|\bconnection\(\)|\bdraftMode\(\)/;

describe("rutas", () => {
  it("ficha pública → ruta interna; lo demás, null", () => {
    expect(fichaIsrPath("/es/media/movie/603")).toBe("/es/media-anonima/movie/603");
    expect(fichaIsrPath("/en/media/comic/4050-1/")).toBe("/en/media-anonima/comic/4050-1");
    expect(fichaIsrPath("/fr/media/movie/603")).toBeNull();
    expect(fichaIsrPath("/es/media/movie")).toBeNull();
    expect(fichaIsrPath("/es/media/movie/1/2")).toBeNull();
    expect(fichaIsrPath("/es/media-anonima/movie/1")).toBeNull();
  });

  it("la ruta interna se reconoce (para responder 404)", () => {
    expect(isFichaIsrInternalPath("/es/media-anonima/movie/1")).toBe(true);
    expect(isFichaIsrInternalPath("/en/media-anonima")).toBe(true);
    expect(isFichaIsrInternalPath("/es/media-anonimas")).toBe(false);
    expect(isFichaIsrInternalPath("/es/media/movie/1")).toBe(false);
  });
});

describe("quién recibe la ficha cacheable", () => {
  it("sin cookies, o solo con las que no dependen de quién mira", () => {
    expect(isAnonymousForFichaIsr([])).toBe(true);
    expect(isAnonymousForFichaIsr(["NEXT_LOCALE", "kultura_consent"])).toBe(true);
  });

  it("con sesión de Supabase (también troceada) o con la cookie de prueba de «Sala», no", () => {
    expect(isAnonymousForFichaIsr(["sb-abc-auth-token"])).toBe(false);
    expect(isAnonymousForFichaIsr(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])).toBe(false);
    // La misma cookie que define src/lib/flags/sala.ts.
    expect(isAnonymousForFichaIsr([SALA_TEST_COOKIE])).toBe(false);
  });
});

describe("router desde una ficha", () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it("solo el fetch del router (Sec-Fetch-Dest: empty) con una ficha como origen", () => {
    expect(isRouterFetchFromFicha(h({ "sec-fetch-dest": "empty", referer: "https://k.test/es/media/movie/1" }))).toBe(true);
    expect(isRouterFetchFromFicha(h({ "sec-fetch-dest": "document", referer: "https://k.test/es/media/movie/1" }))).toBe(false);
    expect(isRouterFetchFromFicha(h({ "sec-fetch-dest": "empty", referer: "https://k.test/es/u/x" }))).toBe(false);
    expect(isRouterFetchFromFicha(h({ "sec-fetch-dest": "empty" }))).toBe(false);
  });
});

describe("página y layout cacheables", () => {
  const PAGE = "src/app/[locale]/media-anonima/[type]/[id]/page.tsx";
  const LAYOUT = "src/app/[locale]/media-anonima/layout.tsx";
  const SHARED = "src/lib/media/ficha-page.tsx";

  it.each([PAGE, LAYOUT, SHARED])("%s no usa APIs dinámicas", (file) => {
    expect(src(file)).not.toMatch(DYNAMIC_API);
  });

  it("la página: setRequestLocale, ninguna ficha en el build, 6 h de vida y sin sesión", () => {
    const page = src(PAGE);
    expect(page).toMatch(/setRequestLocale\(locale\)/);
    expect(page).toMatch(/export function generateStaticParams\(\) \{\s*return \[\];\s*\}/);
    expect(page).toMatch(/export const revalidate = 21600;/);
    expect(page).not.toMatch(/dynamicParams\s*=\s*false/);
    expect(page).not.toMatch(/getViewer|salaFichaEnabled|getChromeSession/);
  });

  it("el layout no lee la sesión", () => {
    expect(src(LAYOUT)).not.toMatch(/getChromeSession|getViewer|AppChrome/);
  });
});
