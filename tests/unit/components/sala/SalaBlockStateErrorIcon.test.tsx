import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SalaBlockStateErrorIcon } from "@/components/sala/SalaBlockStateErrorIcon";
import { SalaStatusIcon } from "@/components/sala/SalaStatusIcon";
import { SalaBlockState } from "@/components/sala/SalaBlockState";

// SalaBlockState lleva su propio dibujo de error (para no sacar SalaStatusIcon
// del trozo de error.js): tiene que ser el mismo que el de los avisos.
describe("SalaBlockStateErrorIcon", () => {
  it("mismo trazo y mismos atributos que SalaStatusIcon tone=error", () => {
    const a = render(<SalaBlockStateErrorIcon />).container.querySelector("svg")!;
    const b = render(<SalaStatusIcon tone="error" />).container.querySelector("svg")!;
    expect(a.querySelector("path")!.getAttribute("d")).toBe(b.querySelector("path")!.getAttribute("d"));
    for (const attr of ["viewBox", "fill", "stroke", "stroke-width", "stroke-linecap", "aria-hidden", "class", "data-sala-tone-icon"]) {
      expect(a.getAttribute(attr)).toBe(b.getAttribute(attr));
    }
  });

  it("SalaBlockState en error lo pinta", () => {
    const { container } = render(<SalaBlockState tone="error" title="Algo falló" />);
    expect(container.querySelector('[data-sala-tone-icon="error"]')).not.toBeNull();
  });
});
