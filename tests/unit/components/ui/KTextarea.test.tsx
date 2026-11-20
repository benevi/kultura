import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, it, expect } from "vitest";
import { KInput } from "@/components/ui/KInput";
import { KTextarea } from "@/components/ui/KTextarea";

describe("KTextarea — la caja y la accesibilidad de KInput (C14)", () => {
  it("asocia la etiqueta al área aunque no se pase id", () => {
    render(<KTextarea label="Reseña" />);
    expect(screen.getByLabelText("Reseña")).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("dos áreas con la misma etiqueta no comparten id", () => {
    render(
      <>
        <KTextarea label="Nota" />
        <KTextarea label="Nota" />
      </>
    );
    const [a, b] = screen.getAllByRole("textbox");
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it("respeta el id que llega por props", () => {
    render(<KTextarea id="detalles" label="Detalles" />);
    expect(screen.getByLabelText("Detalles")).toHaveAttribute("id", "detalles");
  });

  it("sin error: aria-invalid ausente y la ayuda describe el área", () => {
    render(<KTextarea label="Descripción" hint="Quedan 500 caracteres" />);
    const area = screen.getByLabelText("Descripción");
    expect(area).not.toHaveAttribute("aria-invalid");
    expect(area).toHaveAccessibleDescription("Quedan 500 caracteres");
  });

  it("con error: aria-invalid, descripción, role=alert y borde de error", () => {
    render(<KTextarea label="Detalles" error="Escribe al menos 10 caracteres" />);
    const area = screen.getByLabelText("Detalles");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAccessibleDescription("Escribe al menos 10 caracteres");
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe al menos 10 caracteres");
    expect(area.className).toMatch(/\bborder-accent-danger\b/);
    expect(area.className).not.toMatch(/\bborder-field-border\b/);
  });

  it("conserva un aria-describedby propio (un contador) delante del error", () => {
    render(
      <>
        <span id="contador">3 / 2000</span>
        <KTextarea label="Reseña" error="No se pudo guardar" aria-describedby="contador" />
      </>
    );
    const area = screen.getByLabelText("Reseña");
    expect(area.getAttribute("aria-describedby")!.split(" ")[0]).toBe("contador");
    expect(area).toHaveAccessibleDescription("3 / 2000 No se pudo guardar");
  });

  it("la misma caja que KInput, y además crece solo hacia abajo", () => {
    render(
      <>
        <KInput label="Campo" />
        <KTextarea label="Área" />
      </>
    );
    const input = screen.getByLabelText("Campo").className.split(" ");
    const area = screen.getByLabelText("Área").className.split(" ");
    expect(area.filter((c) => c !== "resize-y")).toEqual(input);
    expect(area).toContain("resize-y");
  });

  it("16 px en móvil y 15 desde md; borde de campo; foco con contorno", () => {
    render(<KTextarea label="Área" />);
    const cls = screen.getByLabelText("Área").className;
    expect(cls).toMatch(/\btext-base\b/);
    expect(cls).toMatch(/\bmd:text-body\b/);
    expect(cls).toMatch(/\bborder-field-border\b/);
    expect(cls).toMatch(/focus-visible:outline-focus-ring/);
    expect(cls).not.toMatch(/\bring-/);
  });

  it("pasa la ref y las props nativas al textarea", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<KTextarea ref={ref} label="Nota" rows={2} maxLength={2000} className="min-h-[88px]" />);
    expect(ref.current).toBe(screen.getByLabelText("Nota"));
    expect(ref.current).toHaveAttribute("rows", "2");
    expect(ref.current).toHaveAttribute("maxlength", "2000");
    expect(ref.current!.className).toMatch(/min-h-\[88px\]/);
  });
});
