// ============================================================
// KULTURA — Un cromo de la portada cuya portada falla deja el respaldo de
// color, nunca el icono de imagen rota ni un hueco.
// ============================================================

import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LandingCromo } from "@/components/landing/LandingCromo";

const props = { title: "Peli", seed: "movie_1", poster: "https://image.tmdb.org/t/p/w500/x.jpg", sizes: "100px" };

describe("LandingCromo · portada que no carga", () => {
  it("el respaldo de color va detrás y primero; la portada encima", () => {
    const { container } = render(<LandingCromo {...props} />);
    const cromo = container.querySelector("[data-cromo]") as HTMLElement;
    expect(cromo.className).toContain("border-cromo-border");
    const [first, second] = Array.from(cromo.children);
    expect(first.hasAttribute("data-placeholder")).toBe(true);
    expect((first as HTMLElement).style.background).toContain("linear-gradient");
    expect(second.tagName).toBe("IMG");
  });

  it("si la imagen falla se retira y queda el respaldo", () => {
    const { container } = render(<LandingCromo {...props} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-placeholder]")).not.toBeNull();
  });

  it("una portada nueva se vuelve a intentar", () => {
    const { container, rerender } = render(<LandingCromo {...props} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    rerender(<LandingCromo {...props} poster="https://image.tmdb.org/t/p/w500/y.jpg" />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("el título queda para el lector y el brillo solo si se pide", () => {
    const { container, getByText, rerender } = render(<LandingCromo {...props} />);
    expect(getByText("Peli").className).toContain("sr-only");
    expect(container.querySelector(".cromo-foil")).toBeNull();
    rerender(<LandingCromo {...props} foil />);
    expect(container.querySelector(".cromo-foil")).not.toBeNull();
  });
});
