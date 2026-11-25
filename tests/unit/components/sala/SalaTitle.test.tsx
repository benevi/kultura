import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SalaTitle } from "@/components/sala/SalaTitle";

/**
 * Nombre accesible del rótulo: los `<br>` de un título sin espacios (japonés,
 * coreano) metían un espacio en el nombre en Chromium. Entonces el rótulo va
 * con `aria-hidden` y el título tal cual en texto oculto (`sr-only`).
 */
describe("SalaTitle · nombre accesible", () => {
  it("título japonés partido: el nombre es el título tal cual y el rótulo no se lee", () => {
    const title = "転生したらスライムだった件";
    render(<SalaTitle title={title} titleLang="ja" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    const rotulo = h1.querySelector<HTMLElement>("[data-sala-title-text]")!;
    // Precondición: el rótulo parte el título.
    expect(rotulo.querySelector("br")).not.toBeNull();
    expect(rotulo).toHaveAttribute("aria-hidden", "true");
    const nombre = h1.querySelector<HTMLElement>("[data-sala-title-name]")!;
    expect(nombre).toHaveClass("sr-only");
    expect(nombre.textContent).toBe(title);
    expect(h1).toHaveAccessibleName(title);
  });

  it("título con espacios: un solo texto, el del rótulo, que se lee", () => {
    render(<SalaTitle title="El señor de los anillos: la comunidad del anillo" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.querySelector("[data-sala-title-name]")).toBeNull();
    expect(h1.querySelector("[data-sala-title-text]")).not.toHaveAttribute("aria-hidden");
    expect(h1).toHaveAccessibleName("El señor de los anillos: la comunidad del anillo");
  });
});
