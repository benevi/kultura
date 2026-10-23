// ============================================================
// KULTURA — Una portada que falla en la landing deja el gradiente, nunca el
// icono de imagen rota.
// ============================================================

import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, onError }: { src: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={onError} />
  ),
}));

import { PosterTile } from "@/components/landing/PosterTile";

const item = { id: "movie_1", title: "Peli", type: "movie" as const, poster: "https://image.tmdb.org/t/p/w500/x.jpg" };

describe("PosterTile · portada que no carga", () => {
  it("el gradiente va detrás de la portada", () => {
    const { container } = render(<PosterTile item={item} sizes="100px" />);
    const tile = container.firstElementChild as HTMLElement;
    const [first, second] = Array.from(tile.children);
    expect(first.getAttribute("aria-hidden")).toBe("true");
    expect((first as HTMLElement).style.background).toContain("linear-gradient");
    expect(second.tagName).toBe("IMG");
  });

  it("si la imagen falla se retira y queda el gradiente", () => {
    const { container } = render(<PosterTile item={item} sizes="100px" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    const tile = container.firstElementChild as HTMLElement;
    expect((tile.firstElementChild as HTMLElement).style.background).toContain("linear-gradient");
  });

  it("una portada nueva se vuelve a intentar", () => {
    const { container, rerender } = render(<PosterTile item={item} sizes="100px" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    rerender(<PosterTile item={{ ...item, poster: "https://image.tmdb.org/t/p/w500/y.jpg" }} sizes="100px" />);
    expect(container.querySelector("img")).not.toBeNull();
  });
});
