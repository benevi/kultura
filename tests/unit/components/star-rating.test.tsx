import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
}));

import { StarRating } from "@/components/ui/StarRating";

describe("StarRating", () => {
  it("renderiza 5 estrellas en modo interactivo, como radios de un grupo", () => {
    const handleChange = vi.fn();
    render(<StarRating value={3} onChange={handleChange} label="Puntuación" />);
    expect(screen.getByRole("radiogroup", { name: "Puntuación" })).toBeInTheDocument();
    const stars = screen.getAllByRole("radio");
    expect(stars).toHaveLength(5);
    expect(stars[2]).toHaveAttribute("aria-checked", "true");
    // Nombre traducido con plural ICU (antes "3 estrellas" fijo en español).
    expect(stars[2]).toHaveAccessibleName('stars:{"count":3}');
  });

  it("renderiza 5 estrellas en modo readonly (sin onChange) con el valor legible", () => {
    render(<StarRating value={3} />);
    expect(document.querySelectorAll("[data-star]")).toHaveLength(5);
    // ACC-8: la nota de solo lectura se anuncia ("3 de 5").
    expect(screen.getByRole("img")).toHaveAccessibleName('ratingOf:{"value":3,"max":5}');
  });

  it("readonly sin nota → 'Sin puntuar'", () => {
    render(<StarRating value={0} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("notRated");
  });

  it("llama onChange con valor correcto al click", () => {
    const handleChange = vi.fn();
    render(<StarRating value={2} onChange={handleChange} />);
    const stars = screen.getAllByRole("radio");
    fireEvent.click(stars[3]); // 4th star (index 3) = value 4
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it("llama onChange con valor 1 al click en primera estrella", () => {
    const handleChange = vi.fn();
    render(<StarRating value={0} onChange={handleChange} />);
    const stars = screen.getAllByRole("radio");
    fireEvent.click(stars[0]);
    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it("NO llama onChange si no se pasa (readonly)", () => {
    render(<StarRating value={3} />);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  // ── ACC-8: teclado ───────────────────────────────────────────────────────

  it("una sola parada de Tab: la estrella marcada", () => {
    render(<StarRating value={3} onChange={vi.fn()} />);
    const tabbable = screen.getAllByRole("radio").map((s) => s.getAttribute("tabindex"));
    expect(tabbable).toEqual(["-1", "-1", "0", "-1", "-1"]);
  });

  it("→ sube, ← baja, Inicio/Fin a los extremos y el foco acompaña", () => {
    const handleChange = vi.fn();
    render(<StarRating value={3} onChange={handleChange} />);
    const stars = screen.getAllByRole("radio");
    stars[2].focus();
    fireEvent.keyDown(stars[2], { key: "ArrowRight" });
    expect(handleChange).toHaveBeenLastCalledWith(4);
    expect(document.activeElement).toBe(stars[3]);
    fireEvent.keyDown(stars[2], { key: "ArrowLeft" });
    expect(handleChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(stars[2], { key: "End" });
    expect(handleChange).toHaveBeenLastCalledWith(5);
    fireEvent.keyDown(stars[2], { key: "Home" });
    expect(handleChange).toHaveBeenLastCalledWith(1);
  });

  it("el foco es visible (sin `focus:outline-none` a secas)", () => {
    render(<StarRating value={1} onChange={vi.fn()} />);
    const star = screen.getAllByRole("radio")[0];
    expect(star.className).toContain("focus-visible:outline-focus-ring");
    expect(star.className).not.toMatch(/(^|\s)focus:outline-none/);
  });
});
