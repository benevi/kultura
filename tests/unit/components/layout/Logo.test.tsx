import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Logo } from "@/components/layout/Logo";

describe("Logo", () => {
  it("el wordmark no se parte en dos líneas (a 320 px el punto caía debajo)", () => {
    render(<Logo />);
    expect(screen.getByText("kultura")).toHaveClass("whitespace-nowrap");
  });

  it("el logotipo completo no se encoge dentro de una fila flex", () => {
    const { container } = render(<Logo />);
    expect(container.firstElementChild).toHaveClass("shrink-0");
  });

  it("variant=mark pinta solo el icono", () => {
    render(<Logo variant="mark" />);
    expect(screen.queryByText("kultura")).not.toBeInTheDocument();
  });
});
