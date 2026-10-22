import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Input } from "@/components/ui/input";

describe("Input — clases que existen, 16 px en móvil y errores anunciados", () => {
  it("no usa colores shadcn que no existen en el tema (ring-ring, ring-offset-background)", () => {
    render(<Input aria-label="Buscar" />);
    const cls = screen.getByLabelText("Buscar").className;
    expect(cls).not.toMatch(/ring-ring|ring-offset-background/);
    expect(cls).toMatch(/focus-visible:outline-focus-ring/);
    expect(cls).toMatch(/\bborder-field-border\b/);
  });

  it("16 px en móvil y 14 px desde md", () => {
    render(<Input aria-label="Buscar" />);
    const cls = screen.getByLabelText("Buscar").className;
    expect(cls).toMatch(/\btext-base\b/);
    expect(cls).toMatch(/\bmd:text-sm\b/);
  });

  it("con error: aria-invalid, descripción y role=alert", () => {
    render(<Input label="Nombre" error="Obligatorio" />);
    const input = screen.getByLabelText("Nombre");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Obligatorio");
    expect(screen.getByRole("alert")).toHaveTextContent("Obligatorio");
  });
});
