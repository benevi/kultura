import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StarRating } from "@/components/ui/StarRating";

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
});
