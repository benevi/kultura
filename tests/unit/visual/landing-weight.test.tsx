/**
 * F-30 · Portada: JS ≤ 150 KB.
 *
 * - three.js SOLO en `sobre-scene.ts`, y ese módulo solo se carga con
 *   `import()` (tras el primer pintado y en un rato libre): nada de three en el
 *   JS inicial de `/es`.
 * - Las piezas de cliente de la portada no arrastran `next/image` (≈ 6 KB):
 *   ni `Cromo` (que lo importa) ni `PosterImage`; los cromos de la página
 *   derecha los pinta el servidor y llegan como hijos.
 * - `LandingPosterImage` no usa `next/image`.
 * - GSAP no entra en la portada.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LandingPosterImage, landingSrcSet } from "@/components/landing/LandingPosterImage";

const ROOT = resolve(__dirname, "../../..");
const code = (p: string) => readFileSync(resolve(ROOT, p), "utf8").replace(/\/\/.*$/gm, "");
const LANDING = ["src/components/landing", "src/lib/landing"].flatMap((dir) =>
  readdirSync(resolve(ROOT, dir)).map((f) => `${dir}/${f}`)
);
const isClient = (p: string) => /^\s*["']use client["']/.test(readFileSync(resolve(ROOT, p), "utf8"));

describe("peso de la portada", () => {
  it("three.js solo lo importa la escena del sobre", () => {
    const importers = [...LANDING, "src/app/[locale]/page.tsx"].filter((p) => /from\s+["']three["']/.test(code(p)));
    expect(importers).toEqual(["src/lib/landing/sobre-scene.ts"]);
  });

  it("la escena del sobre solo se carga con import() dinámico", () => {
    const statics = [...LANDING, "src/app/[locale]/page.tsx"].filter((p) =>
      /import\s+(?!type\b)[^;]*from\s+["']@\/lib\/landing\/sobre-scene["']/.test(code(p))
    );
    expect(statics).toEqual([]);
    expect(code("src/components/landing/MissingPage.tsx")).toMatch(/import\(\s*["']@\/lib\/landing\/sobre-scene["']\s*\)/);
  });

  it("ninguna pieza de cliente de la portada importa Cromo, PosterImage ni next/image", () => {
    const clients = LANDING.filter((p) => p.endsWith(".tsx") && isClient(p));
    expect(clients.length).toBeGreaterThanOrEqual(3);
    for (const p of clients) {
      expect(code(p), p).not.toMatch(/from\s+["'](next\/image|@\/components\/album\/Cromo|@\/components\/album|@\/components\/media\/PosterImage)["']/);
    }
  });

  it("sin GSAP en la portada", () => {
    for (const p of LANDING) expect(code(p), p).not.toMatch(/from\s+["']gsap["']|loadGsap/);
  });

  it("LandingPosterImage no importa next/image ni PosterImage", () => {
    const src = code("src/components/landing/LandingPosterImage.tsx");
    expect(src).not.toMatch(/next\/image|PosterImage"/);
  });

  it("la portada nativa usa el loader del CDN con srcset y carga diferida", () => {
    const { container } = render(
      <LandingPosterImage src="https://image.tmdb.org/t/p/original/a.jpg" sizes="140px" />
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("srcset")).toBe(landingSrcSet("https://image.tmdb.org/t/p/original/a.jpg"));
    expect(img.getAttribute("srcset")).toContain("https://image.tmdb.org/t/p/w154/a.jpg 128w");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("alt")).toBe("");
  });

  it("la portada prioritaria (LCP) no es diferida y va con prioridad alta", () => {
    const { container } = render(
      <LandingPosterImage src="https://image.tmdb.org/t/p/original/a.jpg" sizes="140px" priority />
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("eager");
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });
});

describe("portada rota antes de hidratar (revisión #57)", () => {
  // La portada estática de la landing llega en el HTML: si da 404 antes de
  // que React hidrate, el `onError` ya ha pasado y nadie lo escucha. Al
  // montar hay que mirar si la imagen ya terminó sin píxeles.
  it("si al montar la imagen ya falló (complete y sin ancho), se retira y queda el respaldo", () => {
    const proto = HTMLImageElement.prototype;
    const complete = Object.getOwnPropertyDescriptor(proto, "complete");
    const natural = Object.getOwnPropertyDescriptor(proto, "naturalWidth");
    Object.defineProperty(proto, "complete", { configurable: true, get: () => true });
    Object.defineProperty(proto, "naturalWidth", { configurable: true, get: () => 0 });
    try {
      const { container } = render(<LandingPosterImage src="https://image.tmdb.org/t/p/original/rota.jpg" sizes="140px" />);
      expect(container.querySelector("img")).toBeNull();
    } finally {
      if (complete) Object.defineProperty(proto, "complete", complete);
      else delete (proto as unknown as Record<string, unknown>).complete;
      if (natural) Object.defineProperty(proto, "naturalWidth", natural);
      else delete (proto as unknown as Record<string, unknown>).naturalWidth;
    }
  });

  it("una imagen aún sin cargar (lazy) no se retira", () => {
    const proto = HTMLImageElement.prototype;
    const complete = Object.getOwnPropertyDescriptor(proto, "complete");
    Object.defineProperty(proto, "complete", { configurable: true, get: () => false });
    try {
      const { container } = render(<LandingPosterImage src="https://image.tmdb.org/t/p/original/b.jpg" sizes="140px" />);
      expect(container.querySelector("img")).not.toBeNull();
    } finally {
      if (complete) Object.defineProperty(proto, "complete", complete);
      else delete (proto as unknown as Record<string, unknown>).complete;
    }
  });
});
