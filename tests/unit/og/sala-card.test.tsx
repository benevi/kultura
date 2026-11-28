// ============================================================
// Fase 8.5 · M1 — plantilla de la tarjeta OG de «Sala» (aún sin ruta).
//   - el logotipo va en trazados, el mismo de `public/brand/`;
//   - titular y lema en la tarjeta; sin imagen, un campo de color (nunca una
//     imagen rota);
//   - pide Anybody 800 e Instrument Sans recortadas a su texto.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

const h = vi.hoisted(() => ({ loadFont: vi.fn() }));
vi.mock("@/lib/og/brand", () => ({ loadFont: h.loadFont }));

import { SalaSiteCard, SalaLogotype, salaCardFonts, SALA_OG_SIZE } from "@/lib/og/sala-card";
import { SALA_SYMBOL_PATH, SALA_WORD_PATH } from "@/lib/brand/sala-logo";

type Node = ReactElement<{ children?: unknown; src?: string; d?: string }>;

/** Todos los elementos del árbol, resolviendo los componentes de función. */
function walk(node: unknown, out: Node[] = []): Node[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, out));
    return out;
  }
  const el = node as Node;
  if (typeof el.type === "function") return walk((el.type as (p: unknown) => unknown)(el.props), out);
  out.push(el);
  walk(el.props?.children, out);
  return out;
}

const texts = (node: unknown) =>
  walk(node)
    .map((e) => e.props.children)
    .filter((c): c is string => typeof c === "string");

beforeEach(() => h.loadFont.mockReset());

describe("tarjeta OG de «Sala»", () => {
  it("mide 1200×630", () => {
    expect(SALA_OG_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("lleva el logotipo en trazados, el titular y el lema", () => {
    const tree = SalaSiteCard({ title: "Tus series, al día.", lema: "Gratis y sin anuncios." });
    const paths = walk(tree).filter((e) => e.type === "path").map((e) => e.props.d);
    expect(paths).toEqual([SALA_SYMBOL_PATH, SALA_WORD_PATH]);
    expect(texts(tree)).toEqual(["Tus series, al día.", "Gratis y sin anuncios."]);
  });

  it("sin imagen pinta un campo de color; con imagen, la imagen", () => {
    const sin = walk(SalaSiteCard({ title: "t", lema: "l" }));
    expect(sin.some((e) => e.type === "img")).toBe(false);
    const con = walk(SalaSiteCard({ title: "t", lema: "l", image: "data:image/jpeg;base64,AAA" }));
    expect(con.find((e) => e.type === "img")?.props.src).toBe("data:image/jpeg;base64,AAA");
  });

  it("el logotipo guarda la proporción del SVG", () => {
    const svg = SalaLogotype({ height: 64 }) as ReactElement<{ width: number; height: number }>;
    expect(svg.props).toMatchObject({ width: 431, height: 64 });
  });

  it("pide Anybody 800 con el titular en caja alta e Instrument Sans con el lema", async () => {
    h.loadFont.mockImplementation(async (family: string) => (family === "Anybody" ? { name: "Anybody" } : null));
    const fonts = await salaCardFonts("al día", "Gratis");
    expect(h.loadFont).toHaveBeenCalledWith("Anybody", 800, "AL DÍA");
    expect(h.loadFont).toHaveBeenCalledWith("Instrument+Sans", 500, "Gratis");
    expect(fonts).toEqual([{ name: "Anybody" }]);
  });
});
