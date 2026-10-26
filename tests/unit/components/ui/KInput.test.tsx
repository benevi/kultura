import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { KInput } from "@/components/ui/KInput";

describe("KInput — errores anunciados y foco visible (ACC-3, ACC-4, MOV-5)", () => {
  it("asocia la etiqueta al campo aunque no se pase id", () => {
    render(<KInput label="Correo electrónico" />);
    expect(screen.getByLabelText("Correo electrónico")).toBeInstanceOf(HTMLInputElement);
  });

  it("dos campos con la misma etiqueta no comparten id", () => {
    render(
      <>
        <KInput label="Nombre" />
        <KInput label="Nombre" />
      </>
    );
    const [a, b] = screen.getAllByRole("textbox");
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it("respeta el id que llega por props", () => {
    render(<KInput id="email" label="Correo" />);
    expect(screen.getByLabelText("Correo")).toHaveAttribute("id", "email");
  });

  it("sin error: aria-invalid ausente y el hint describe el campo", () => {
    render(<KInput label="Usuario" hint="Entre 3 y 20 caracteres" />);
    const input = screen.getByLabelText("Usuario");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Entre 3 y 20 caracteres");
  });

  it("con error: aria-invalid, descripción y role=alert", () => {
    render(<KInput label="Contraseña" error="Mínimo 8 caracteres" />);
    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Mínimo 8 caracteres");
    expect(screen.getByRole("alert")).toHaveTextContent("Mínimo 8 caracteres");
  });

  it("conserva un aria-describedby propio además del error", () => {
    render(
      <>
        <p id="extra">Texto extra</p>
        <KInput label="Email" error="Formato no válido" aria-describedby="extra" />
      </>
    );
    const ids = screen.getByLabelText("Email").getAttribute("aria-describedby")!.split(" ");
    expect(ids).toContain("extra");
    expect(ids).toHaveLength(2);
  });

  it("borde de campo de 1 px y contorno de foco visible (no un halo al 25 %)", () => {
    render(<KInput label="Campo" />);
    const cls = screen.getByLabelText("Campo").className;
    expect(cls).toMatch(/\bborder\b/);
    expect(cls).toMatch(/\bborder-field-border\b/);
    expect(cls).toMatch(/focus-visible:outline-focus-ring/);
    expect(cls).toMatch(/focus-visible:outline-2\b/);
    // `focus-visible:outline` a secas lo borra tailwind-merge al verlo junto a
    // `outline-2`, y el estilo caía al `auto` del navegador.
    expect(cls).toContain("focus-visible:[outline-style:solid]");
    expect(cls).not.toMatch(/0_0_0_6px/);
  });

  it("con error el borde pasa a rojo", () => {
    render(<KInput label="Campo" error="Mal" />);
    expect(screen.getByLabelText("Campo").className).toMatch(/\bborder-accent-danger\b/);
  });

  it("16 px en móvil para que iOS no haga zoom al enfocar (15 px desde md)", () => {
    render(<KInput label="Campo" />);
    const cls = screen.getByLabelText("Campo").className;
    expect(cls).toMatch(/\btext-base\b/);
    expect(cls).toMatch(/\bmd:text-body\b/);
    expect(cls).not.toMatch(/(^|\s)text-body\b/);
  });

  it("type=email: sin mayúscula automática ni corrector", () => {
    render(<KInput label="Email" type="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("spellcheck", "false");
  });
});
