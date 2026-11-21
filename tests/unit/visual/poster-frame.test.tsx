/**
 * F-30 · DIS-7: una sola tarjeta de póster.
 *
 * Antes cada fila pintaba su póster a mano (radios 18, 20 y 22 para la misma
 * portada; título encima en unas y debajo en otras). Ahora todas usan
 * `PosterFrame`: radio de póster, 2:3 y gradiente de respaldo detrás.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PosterFrame } from "@/components/media/PosterFrame";
import { posterFrameClass } from "@/components/media/poster-frame-class";
import { posterGradientFeature } from "@/lib/images/poster-gradient";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img src={String(props.src)} alt={String(props.alt)} />,
}));

const ROOT = resolve(__dirname, "../../..");

describe("PosterFrame", () => {
  it("radio de póster, 2:3 y el gradiente PRIMERO (detrás de la portada)", () => {
    const { container } = render(<PosterFrame seed="tmdb_550" title="Fight Club" poster="https://x/p.jpg" sizes="100px" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toContain("rounded-2xl");
    expect(frame.className).toContain("aspect-[2/3]");
    const placeholder = frame.querySelector("[data-placeholder]")!;
    const img = frame.querySelector("img")!;
    expect(placeholder.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(placeholder.textContent).toBe("FI");
  });

  it("sin portada queda el bloque de color con iniciales, nunca un hueco", () => {
    const { container } = render(<PosterFrame seed="x" title="Akira" sizes="100px" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-placeholder]")!.getAttribute("style")).toContain("linear-gradient");
  });

  it("miniatura (C14): radio 8, sin iniciales, sin zoom y sin fondo elevado si se pide", () => {
    const { container } = render(
      <PosterFrame
        as="span"
        aria-hidden="true"
        seed="tmdb_550"
        title="Fight Club"
        poster="https://x/p.jpg"
        sizes="48px"
        radius="sm"
        initials={false}
        zoom={false}
        elevated={false}
        className="h-[72px] w-12 shrink-0"
      />
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.tagName).toBe("SPAN");
    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(frame.className).toContain("rounded-lg");
    expect(frame.className).not.toContain("rounded-2xl");
    expect(frame.className).not.toContain("bg-surface-elevated");
    // twMerge: el ancho de quien lo usa gana a `w-full`.
    expect(frame.className).toContain("w-12");
    expect(frame.className).not.toContain("w-full");
    const placeholder = frame.querySelector("[data-placeholder]")!;
    expect(placeholder.tagName).toBe("SPAN");
    expect(placeholder.textContent).toBe("");
    expect(placeholder.getAttribute("style")).toContain("linear-gradient");
  });

  it("la clase compartida de /best no arrastra el componente de cliente", () => {
    const code = readFileSync(resolve(ROOT, "src/components/media/poster-frame-class.ts"), "utf8");
    const imports = code.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual(['import { cn } from "@/lib/utils/index";']);
    expect(code).not.toMatch(/^["']use client["']/m);
    expect(posterFrameClass()).toBe("relative overflow-hidden rounded-2xl aspect-[2/3]");
    expect(posterFrameClass({ radius: "sm", className: "w-16" })).toBe("relative overflow-hidden rounded-lg aspect-[2/3] w-16");
  });

  it("posterGradientFeature conserva la fórmula de la ficha", () => {
    expect(posterGradientFeature("tmdb_550")).toMatch(
      /^radial-gradient\(120% 90% at 20% 15%, oklch\(50% 0\.16 \d+ \/ 0\.55\) 0%, transparent 55%\), linear-gradient\(160deg, oklch\(38% 0\.13 \d+\), oklch\(18% 0\.06 \d+\)\)$/
    );
  });

  it.each([
    "src/components/media/MediaCard.tsx",
    "src/components/home/MediaRow.tsx",
    "src/components/home/ContinueRow.tsx",
    "src/components/collection/PublicCollection.tsx",
    "src/app/[locale]/(app)/calendar/page.tsx",
    "src/app/[locale]/(app)/home/sections.tsx",
    "src/app/[locale]/(app)/home/TonightClient.tsx",
    "src/app/[locale]/u/[username]/r/[type]/[id]/page.tsx",
    "src/app/[locale]/welcome/RateTile.tsx",
    "src/components/library/DiaryList.tsx",
    "src/components/media/AdaptationsSection.tsx",
    "src/app/[locale]/(app)/lists/[id]/ReorderableItems.tsx",
    "src/components/search/SearchBar.tsx",
  ])("%s usa la tarjeta única", (file) => {
    const code = readFileSync(resolve(ROOT, file), "utf8");
    expect(code).toMatch(/<PosterFrame\b/);
    expect(code).not.toMatch(/posterGradient\(/);
  });
});
