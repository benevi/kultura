import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { fill: _fill, ...rest } = props;
    return <img {...rest} />;
  },
}));

import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("muestra iniciales cuando no hay src", () => {
    render(<Avatar initials="JD" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("aplica backgroundColor del prop color", () => {
    render(<Avatar initials="JD" color="#123456" />);
    const avatar = screen.getByText("JD").closest("div");
    expect(avatar).toHaveStyle({ backgroundColor: "#123456" });
  });

  it("usa color por defecto (surface-elevated) cuando no se pasa color", () => {
    render(<Avatar initials="AB" />);
    const avatar = screen.getByText("AB").closest("div");
    expect(avatar).toHaveStyle({ backgroundColor: "var(--surface-elevated)" });
  });

  it("redirige el rojo legacy #E82020 a --accent-positive", () => {
    render(<Avatar initials="VF" color="#E82020" />);
    const avatar = screen.getByText("VF").closest("div");
    expect(avatar).toHaveStyle({ backgroundColor: "var(--accent-positive)" });
  });

  it("un nombre de la paleta pinta su color OKLCH, no el color CSS homónimo", () => {
    render(<Avatar initials="SL" color="slate" />);
    const avatar = screen.getByText("SL").closest("div");
    // `slate` no es un color CSS: antes el círculo salía transparente.
    expect(avatar?.getAttribute("style")).toContain("background-color: oklch(0.72 0.03 260)");
    expect(avatar?.getAttribute("style")).toContain("; color: oklch(0.16 0.02 260)");
  });

  it("'blue' usa el azul de la paleta y no el azul puro de CSS", () => {
    render(<Avatar initials="BL" color="blue" />);
    const style = screen.getByText("BL").closest("div")?.getAttribute("style") ?? "";
    expect(style).toContain("background-color: oklch(0.68 0.16 250)");
    expect(style).not.toMatch(/background-color:\s*blue/);
  });

  it("las iniciales ya no van siempre en blanco: hex claro → texto oscuro", () => {
    render(<Avatar initials="GR" color="#6FCF97" />);
    const avatar = screen.getByText("GR").closest("div");
    expect(avatar).not.toHaveClass("text-white");
    expect(avatar?.getAttribute("style")).toContain("color: var(--surface-base)");
  });

  it("hex oscuro → texto claro del sistema", () => {
    render(<Avatar initials="DK" color="#123456" />);
    expect(screen.getByText("DK").closest("div")?.getAttribute("style")).toContain("color: var(--text-primary)");
  });

  it("el rojo legacy lleva el texto on-positive", () => {
    render(<Avatar initials="LR" color="#E82020" />);
    expect(screen.getByText("LR").closest("div")?.getAttribute("style")).toContain("color: var(--on-accent-positive)");
  });

  it("renderiza image cuando hay src", () => {
    render(<Avatar initials="JD" src="https://example.com/avatar.jpg" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("no muestra iniciales cuando hay src", () => {
    render(<Avatar initials="JD" src="https://example.com/avatar.jpg" />);
    expect(screen.queryByText("JD")).not.toBeInTheDocument();
  });
});
