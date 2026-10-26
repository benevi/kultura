/**
 * F-30 · Portada: JS ≤ 150 KB y sin salto bajo el hero.
 *
 * - El collage de escritorio se pinta en el servidor y entra en
 *   `ImmersiveBackdrop` (cliente) como hijo: si el cliente lo importara,
 *   sus iconos, `cn`/tailwind-merge y portadas viajarían en el JS de `/es`.
 * - `LandingPosterImage` no usa `next/image` (≈ 6 KB de cliente).
 * - La tira móvil reserva su hueco (fallback del Suspense y < 4 portadas):
 *   antes entraba tarde y empujaba la página (CLS 0,07).
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HeroStrip, HeroStripPlaceholder } from "@/components/landing/HeroCollage";
import { LandingPosterImage, landingSrcSet } from "@/components/landing/LandingPosterImage";

const ROOT = resolve(__dirname, "../../..");
const code = (p: string) => readFileSync(resolve(ROOT, p), "utf8").replace(/\/\/.*$/gm, "");

describe("peso de la portada", () => {
  it("ImmersiveBackdrop (cliente) no importa el collage", () => {
    expect(code("src/components/landing/ImmersiveBackdrop.tsx")).not.toMatch(/from ["']@\/components\/landing\/HeroCollage["']/);
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
});

describe("tira móvil del hero sin salto", () => {
  const box = (el: Element) => el.firstElementChild!.className;

  it("con < 4 portadas pinta el hueco reservado, no nada", () => {
    const empty = render(<HeroStrip items={[]} />).container;
    const placeholder = render(<HeroStripPlaceholder />).container;
    expect(empty.firstElementChild).not.toBeNull();
    expect(box(empty)).toBe(box(placeholder));
    expect(placeholder.firstElementChild!.children).toHaveLength(4);
  });

  it("la página usa el hueco como fallback del Suspense de la tira", () => {
    expect(code("src/app/[locale]/page.tsx")).toMatch(/<Suspense fallback=\{<HeroStripPlaceholder \/>\}>\s*<HeroStripSlot/);
  });
});
