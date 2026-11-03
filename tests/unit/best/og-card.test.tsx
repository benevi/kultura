/**
 * Tarjeta de compartir de un ranking (1200×630) y marca de las tarjetas en
 * el sistema «Álbum de cromos»: campo cian, titular en Lilita One con el texto
 * de `best.title`, las tres portadas reales como cromos con su número y los
 * colores de formato exactos de DISENO.md.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const captured = vi.hoisted(() => ({ tree: null as unknown, opts: null as unknown }));
const fonts = vi.hoisted(() => ({ calls: [] as Array<[string, number, string]> }));

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(tree: unknown, opts: unknown) {
      captured.tree = tree;
      captured.opts = opts;
    }
  },
}));
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/og/brand", async (orig) => {
  const real = await orig<typeof import("@/lib/og/brand")>();
  const loadFont = async (family: string, weight: number, text: string) => {
    fonts.calls.push([family, weight, text]);
    return { name: family.replace(/\+/g, " "), data: new ArrayBuffer(1), weight, style: "normal" as const };
  };
  return {
    ...real,
    loadFont,
    loadDisplayFont: (text: string) => loadFont("Lilita+One", 400, text),
    loadLogoFont: () => loadFont("Bricolage+Grotesque", 700, "kultura."),
  };
});
vi.mock("@/lib/og/poster", () => ({ posterDataUri: async (src: string) => `data:image/png;base64,${src.length}` }));
vi.mock("@/lib/best/best-of", async (orig) => {
  const real = await orig<typeof import("@/lib/best/best-of")>();
  return {
    ...real,
    getBestOf: async () =>
      [1, 2, 3, 4].map((i) => ({ id: `movie_${i}`, type: "movie", title: `Peli ${i}`, poster: `https://image.tmdb.org/t/p/w500/${i}.jpg` })),
  };
});

import Image, { size } from "@/app/[locale]/best/[format]/[year]/opengraph-image";
import { C, FORMAT_HEX, fontsOption } from "@/lib/og/brand";

/** Resuelve los componentes de función (OgCromo…) y junta textos y estilos. */
function flatten(node: ReactNode, out: { text: string[]; styles: Array<Record<string, unknown>>; imgs: string[] }) {
  if (Array.isArray(node)) return node.forEach((n) => flatten(n, out));
  if (typeof node === "string" || typeof node === "number") {
    out.text.push(String(node));
    return;
  }
  if (!isValidElement(node)) return;
  const el = node as ReactElement<{ style?: Record<string, unknown>; children?: ReactNode; src?: string }>;
  if (typeof el.type === "function") return flatten((el.type as (p: unknown) => ReactNode)(el.props), out);
  if (el.props.style) out.styles.push(el.props.style);
  if (el.type === "img" && el.props.src) out.imgs.push(el.props.src);
  flatten(el.props.children, out);
}

beforeEach(() => {
  fonts.calls = [];
  captured.tree = null;
});

describe("tarjeta OG de un ranking", () => {
  it("1200×630, campo cian, titular de best.title en Lilita One y las tres portadas con su número", async () => {
    await Image({ params: { locale: "es", format: "movie", year: "2025" } });
    expect(size).toEqual({ width: 1200, height: 630 });
    const out = { text: [] as string[], styles: [] as Array<Record<string, unknown>>, imgs: [] as string[] };
    flatten(captured.tree as ReactNode, out);
    expect(out.styles[0].background).toBe("#00a0e3");
    expect(out.text).toContain("Las mejores películas de 2025");
    const display = out.styles.filter((s) => s.fontFamily === "Lilita One");
    expect(display.length).toBeGreaterThanOrEqual(4); // titular + 3 números
    expect(out.imgs).toHaveLength(3);
    for (const n of ["1", "2", "3"]) expect(out.text).toContain(n);
    expect(out.text).toContain("Película");
    // Sin el violeta ni el lima de la paleta anterior.
    const all = JSON.stringify(out.styles);
    expect(all).not.toMatch(/196,240,55|#b83cc8|#9964e5/i);
    expect(fonts.calls.some(([f, w, text]) => f === "Lilita+One" && w === 400 && text.includes("Las mejores películas de 2025"))).toBe(true);
    expect(fonts.calls.some(([f]) => f === "Bricolage+Grotesque")).toBe(true);
  });

  it("en inglés usa el título inglés", async () => {
    await Image({ params: { locale: "en", format: "anime", year: "2024" } });
    const out = { text: [] as string[], styles: [] as Array<Record<string, unknown>>, imgs: [] as string[] };
    flatten(captured.tree as ReactNode, out);
    expect(out.text).toContain("Best anime of 2024");
  });
});

describe("marca de las tarjetas (lib/og/brand)", () => {
  it("tintas del álbum y colores de formato exactos de DISENO.md", () => {
    expect(C.cyan).toBe("#00a0e3");
    expect(C.navy).toBe("#0b2a6b");
    expect(C.ink).toBe("#04102c");
    expect(FORMAT_HEX).toEqual({
      movie: "#ff4f9a",
      tv: "#5aa9ff",
      anime: "#c6f24e",
      manga: "#ff6b5a",
      game: "#3fd9e6",
      book: "#ffb347",
      comic: "#ffe04a",
    });
    expect(C.purpleGlow).not.toMatch(/153,100,229/);
  });

  it("fontsOption descarta las fuentes que no cargaron", () => {
    const font = { name: "Figtree", data: new ArrayBuffer(1), weight: 700 as const, style: "normal" as const };
    expect(fontsOption([null, font])).toEqual({ fonts: [font] });
    expect(fontsOption([null])).toEqual({});
  });
});
