import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StarRating } from "@/components/ui/StarRating";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe("StarRating", () => {
  it("renderiza 5 estrellas en modo interactivo", () => {
    const handleChange = vi.fn();
    render(<StarRating value={3} onChange={handleChange} />);
    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(5);
  });

  it("renderiza 5 estrellas en modo readonly (sin onChange)", () => {
    render(<StarRating value={3} />);
    // En readonly, usa spans, no buttons
    expect(document.querySelectorAll("[data-star]")).toHaveLength(5);
  });

  it("llama onChange con valor correcto al click", () => {
    const handleChange = vi.fn();
    render(<StarRating value={2} onChange={handleChange} />);
    const stars = screen.getAllByRole("button");
    fireEvent.click(stars[3]); // 4th star (index 3) = value 4
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it("llama onChange con valor 1 al click en primera estrella", () => {
    const handleChange = vi.fn();
    render(<StarRating value={0} onChange={handleChange} />);
    const stars = screen.getAllByRole("button");
    fireEvent.click(stars[0]);
    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it("NO llama onChange si no se pasa (readonly)", () => {
    render(<StarRating value={3} />);
    // In readonly mode there are no buttons to click
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });

  it("cada estrella tiene etiqueta traducida con su número", () => {
    render(<StarRating value={0} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: 'starsLabel:{"count":1}' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'starsLabel:{"count":5}' })).toBeInTheDocument();
  });

  it("el foco de teclado es visible (no se anula sin sustituto)", () => {
    render(<StarRating value={0} onChange={vi.fn()} />);
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("focus-visible:ring-2");
    }
  });

  it("modo lectura expone la puntuación a lectores de pantalla", () => {
    render(<StarRating value={4} />);
    expect(screen.getByRole("img", { name: 'starsValue:{"value":4}' })).toBeInTheDocument();
  });
});
