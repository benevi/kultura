import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "@/components/ui/Pagination";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("Pagination", () => {
  it("renderiza el texto de página actual (sin total mentiroso)", () => {
    render(
      <Pagination currentPage={3} hasMore={true} onPageChange={vi.fn()} />
    );
    // E79 slice 1: solo "page X", ya no "of Y".
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("el botón Anterior está deshabilitado en la página 1", () => {
    render(
      <Pagination currentPage={1} hasMore={true} onPageChange={vi.fn()} />
    );
    const prevBtn = screen.getByRole("button", { name: /previous/i });
    expect(prevBtn).toBeDisabled();
  });

  it("el botón Siguiente está deshabilitado cuando no hay más (hasMore=false)", () => {
    render(
      <Pagination currentPage={5} hasMore={false} onPageChange={vi.fn()} />
    );
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();
  });

  it("llama onPageChange(2) al hacer click en Siguiente estando en página 1", () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={1} hasMore={true} onPageChange={handlePageChange} />
    );
    const nextBtn = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledTimes(1);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("llama onPageChange(1) al hacer click en Anterior estando en página 2", () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination currentPage={2} hasMore={true} onPageChange={handlePageChange} />
    );
    const prevBtn = screen.getByRole("button", { name: /previous/i });
    fireEvent.click(prevBtn);
    expect(handlePageChange).toHaveBeenCalledTimes(1);
    expect(handlePageChange).toHaveBeenCalledWith(1);
  });

  it("el botón Anterior está habilitado en páginas > 1", () => {
    render(
      <Pagination currentPage={3} hasMore={true} onPageChange={vi.fn()} />
    );
    const prevBtn = screen.getByRole("button", { name: /previous/i });
    expect(prevBtn).not.toBeDisabled();
  });

  it("el botón Siguiente está habilitado cuando hay más (hasMore=true)", () => {
    render(
      <Pagination currentPage={3} hasMore={true} onPageChange={vi.fn()} />
    );
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).not.toBeDisabled();
  });

  // ── E79 slice 1: caso clave ──────────────────────────────────────────────
  // Última fuente con página llena tras post-filtro → next deshabilitado aunque
  // currentPage sea bajo. El gate ya NO depende de totalPages.
  it("next deshabilitado en la última fuente aunque currentPage sea bajo", () => {
    render(
      <Pagination currentPage={2} hasMore={false} onPageChange={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    // Anterior sigue disponible para retroceder desde una última corta.
    expect(
      screen.getByRole("button", { name: /previous/i })
    ).not.toBeDisabled();
  });
});
