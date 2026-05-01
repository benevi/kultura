// ============================================================
// KULTURA — SearchBar component unit tests
// ============================================================

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(
    () => (key: string) =>
      ({
        placeholder: "Buscar películas, series, anime, libros...",
        searching: "Buscando...",
        noResults: "Sin resultados para",
        all: "Todos",
        title: "Buscar",
        resultsFor: "Resultados para",
      })[key] ?? key
  ),
}));

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/ui/Spinner", () => ({
  Spinner: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className} />
  ),
}));

vi.mock("@/components/ui/Badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

// Mock global fetch
global.fetch = vi.fn();

import { SearchBar } from "@/components/search/SearchBar";

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el input", () => {
    render(<SearchBar />);
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("muestra el defaultValue si se pasa", () => {
    render(<SearchBar defaultValue="inception" />);
    expect(screen.getByRole("searchbox")).toHaveValue("inception");
  });

  it("muestra el placeholder por defecto de i18n", () => {
    render(<SearchBar />);
    expect(
      screen.getByPlaceholderText(
        "Buscar películas, series, anime, libros..."
      )
    ).toBeInTheDocument();
  });

  it("muestra un placeholder personalizado si se pasa", () => {
    render(<SearchBar placeholder="Custom placeholder" />);
    expect(
      screen.getByPlaceholderText("Custom placeholder")
    ).toBeInTheDocument();
  });

  it("con < 2 chars no hace fetch", () => {
    render(<SearchBar />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "a" } });
    // No fetch should be called synchronously
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("Enter navega a /search con el query cuando hay texto suficiente", () => {
    render(<SearchBar defaultValue="inception" />);
    const input = screen.getByRole("searchbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith(
      "/search?q=inception&type=all"
    );
  });

  it("Enter no navega si el valor está vacío", () => {
    render(<SearchBar defaultValue="" />);
    const input = screen.getByRole("searchbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Escape no navega a ningún lado", () => {
    render(<SearchBar defaultValue="test" />);
    const input = screen.getByRole("searchbox");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("acepta prop className y la aplica al contenedor", () => {
    const { container } = render(<SearchBar className="w-full" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("w-full");
  });
});
