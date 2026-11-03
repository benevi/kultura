/**
 * F-30 · DIS-7: una sola tarjeta de póster, ahora el `Cromo` del álbum.
 *
 * Antes cada fila pintaba su póster a mano (radios 18, 20 y 22 para la misma
 * portada; título encima en unas y debajo en otras). Ahora todas pasan por
 * `Cromo` (directamente o a través de `PosterFrame`): radio de cromo (4 px),
 * borde blanco de 3 px, 2:3 y el respaldo de color detrás y primero.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PosterFrame } from "@/components/media/PosterFrame";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img src={String(props.src)} alt={String(props.alt)} />,
}));

const ROOT = resolve(__dirname, "../../..");

describe("PosterFrame → Cromo", () => {
  it("radio de cromo, borde blanco de 3 px, 2:3 y el respaldo PRIMERO (detrás de la portada)", () => {
    const { container } = render(<PosterFrame seed="tmdb_550" title="Fight Club" poster="https://x/p.jpg" sizes="100px" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame).toHaveAttribute("data-cromo");
    expect(frame.className).toContain("rounded-cromo");
    expect(frame.className).toContain("border-[3px]");
    expect(frame.className).toContain("border-cromo-border");
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

  it.each([
    "src/components/media/MediaCard.tsx",
    "src/components/home/MediaRow.tsx",
    "src/components/home/ContinueRow.tsx",
    "src/components/collection/PublicCollection.tsx",
  ])("%s usa la tarjeta única", (file) => {
    const code = readFileSync(resolve(ROOT, file), "utf8");
    expect(code).toMatch(/<(PosterFrame|Cromo)\b/);
    expect(code).not.toMatch(/posterGradient\(/);
  });
});
