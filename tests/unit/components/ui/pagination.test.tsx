import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "@/components/ui/Pagination";

// useTranslations: (key, params) => interpola {n} para distinguir aria-labels
// por número de página ("Page 1", "Page 2", …). Sin params devuelve la clave.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === "pageN") return `Page ${params?.n}`;
    if (key === "previous") return "Previous";
    if (key === "next") return "Next";
    if (key === "paginationLabel") return "Pagination";
    return key;
  },
}));

describe("Pagination — E79 slice 1b (numerada)", () => {
  it("renderiza un nav etiquetado con role navigation", () => {
    render(
      <Pagination
        currentPage={1}
        hasMore
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("navigation", { name: /pagination/i })
    ).toBeInTheDocument();
  });

  it("renderiza los números de página (primera, ventana, última)", () => {
    render(
      <Pagination
        currentPage={5}
        hasMore
        totalPages={10}
        onPageChange={vi.fn()}
      />
    );
    // ventana: 1 … 4 5 6 … 10
    for (const n of [1, 4, 5, 6, 10]) {
      expect(
        screen.getByRole("button", { name: `Page ${n}` })
      ).toBeInTheDocument();
    }
    // 2, 3, 7, 8, 9 quedan colapsados por la elipsis.
    expect(
      screen.queryByRole("button", { name: "Page 3" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Page 8" })
    ).not.toBeInTheDocument();
  });

  it("muestra elipsis donde hay salto entre números", () => {
    render(
      <Pagination
        currentPage={5}
        hasMore
        totalPages={10}
        onPageChange={vi.fn()}
      />
    );
    // Dos saltos (1↔4 y 6↔10) → dos elipsis.
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("sin saltos (total pequeño) no hay elipsis y se listan todas las páginas", () => {
    render(
      <Pagination
        currentPage={2}
        hasMore
        totalPages={3}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.queryByText("…")).not.toBeInTheDocument();
    for (const n of [1, 2, 3]) {
      expect(
        screen.getByRole("button", { name: `Page ${n}` })
      ).toBeInTheDocument();
    }
  });

  it("marca la página activa con aria-current='page'", () => {
    render(
      <Pagination
        currentPage={3}
        hasMore
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );
    const active = screen.getByRole("button", { name: "Page 3" });
    expect(active).toHaveAttribute("aria-current", "page");
    // Las demás no son current.
    const other = screen.getByRole("button", { name: "Page 2" });
    expect(other).not.toHaveAttribute("aria-current");
  });

  it("el botón Anterior está deshabilitado en la página 1", () => {
    render(
      <Pagination
        currentPage={1}
        hasMore
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("el botón Anterior está habilitado en páginas > 1", () => {
    render(
      <Pagination
        currentPage={3}
        hasMore
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /previous/i })
    ).not.toBeDisabled();
  });

  it("el botón Siguiente está deshabilitado cuando no hay más (hasMore=false)", () => {
    render(
      <Pagination
        currentPage={5}
        hasMore={false}
        totalPages={10}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("el botón Siguiente está habilitado cuando hay más (hasMore=true)", () => {
    render(
      <Pagination
        currentPage={3}
        hasMore
        totalPages={10}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
  });

  it("click en un número llama onPageChange(n)", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={5}
        hasMore
        totalPages={10}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Page 1" }));
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("click en Siguiente llama onPageChange(currentPage + 1)", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        hasMore
        totalPages={5}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("click en Anterior llama onPageChange(currentPage - 1)", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        hasMore
        totalPages={5}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  // ── E79 slice 1: el gate de "siguiente" NO depende de totalPages ──────────
  // Última fuente con página llena tras post-filtro → next deshabilitado aunque
  // currentPage sea bajo y totalPages diga que hay más.
  it("next deshabilitado por hasMore=false aunque totalPages > currentPage", () => {
    render(
      <Pagination
        currentPage={2}
        hasMore={false}
        totalPages={50}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    // Anterior sigue disponible para retroceder desde una última corta.
    expect(
      screen.getByRole("button", { name: /previous/i })
    ).not.toBeDisabled();
  });

  // ── E79 slice 2: totalPages null (post-filtro activo, N crudo miente) ──────
  // La ventana se pinta SIN la última página [N] y sin salto a ella.
  describe("totalPages null (post-filtro activo)", () => {
    it("REGRESIÓN: no pinta una última página [N] falsa (p.ej. 45018)", () => {
      // Repro: game+valoracion → totalPages null. SIN el fix (totalPages=45018) la
      // ventana incluiría [45018] con salto directo a páginas vacías.
      render(
        <Pagination
          currentPage={1}
          hasMore
          totalPages={null}
          onPageChange={vi.fn()}
        />
      );
      expect(
        screen.queryByRole("button", { name: "Page 45018" })
      ).not.toBeInTheDocument();
      // Ventana anclada en [1] con vecinos de la actual: [1][2] (current=1).
      expect(
        screen.getByRole("button", { name: "Page 1" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Page 2" })
      ).toBeInTheDocument();
    });

    it("ventana abierta con elipsis de cola (señala 'puede haber más')", () => {
      render(
        <Pagination
          currentPage={4}
          hasMore
          totalPages={null}
          onPageChange={vi.fn()}
        />
      );
      // [1] … [3][4][5] … (cola). Dos elipsis: hueco 1↔3 y la de cola.
      expect(screen.getAllByText("…")).toHaveLength(2);
      for (const n of [1, 3, 4, 5]) {
        expect(
          screen.getByRole("button", { name: `Page ${n}` })
        ).toBeInTheDocument();
      }
    });

    it("gate de 'siguiente' sigue en hasMore (habilitado si hasMore=true)", () => {
      render(
        <Pagination
          currentPage={1}
          hasMore
          totalPages={null}
          onPageChange={vi.fn()}
        />
      );
      expect(
        screen.getByRole("button", { name: /next/i })
      ).not.toBeDisabled();
    });
  });
});
