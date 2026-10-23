// ============================================================
// KULTURA — SearchBar component unit tests
// ============================================================

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useLocale: () => "en",
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

  it("F-06 (DAT-1): las sugerencias se piden con el idioma de la interfaz en la URL", async () => {
    vi.useFakeTimers();
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response);
    render(<SearchBar />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "inception" } });
    await vi.advanceTimersByTimeAsync(450);
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/search?q=inception&locale=en");
    vi.useRealTimers();
  });

  it("F-13 (DAT-8): con la familia activa de Descubrir, las sugerencias se piden de esa familia", async () => {
    vi.useFakeTimers();
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response);
    render(<SearchBar type="manga" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "naruto" } });
    await vi.advanceTimersByTimeAsync(450);
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe(
      "/api/search?q=naruto&locale=en&type=manga"
    );
    vi.useRealTimers();
  });

  it("F-13: con type=all no se manda tipo (cine y series)", async () => {
    vi.useFakeTimers();
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => [] } as Response);
    render(<SearchBar type="all" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "dune" } });
    await vi.advanceTimersByTimeAsync(450);
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/search?q=dune&locale=en");
    vi.useRealTimers();
  });

  it("F-13: al seguir escribiendo se cancela la petición anterior (una respuesta lenta no pisa a la nueva)", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    vi.mocked(global.fetch).mockImplementation((_url, init) => {
      signals.push((init as RequestInit).signal as AbortSignal);
      return new Promise<Response>(() => {});
    });
    render(<SearchBar />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "nar" } });
    await vi.advanceTimersByTimeAsync(450);
    fireEvent.change(input, { target: { value: "naruto" } });
    await vi.advanceTimersByTimeAsync(450);
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    vi.useRealTimers();
  });

  it("modo navigate (default): Enter navega a /search con el query", () => {
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

// ── modo inline (E-DISCOVER-SEARCH-MERGE) ─────────────────────────────────────
// En Descubrir, buscar NO debe navegar a otra pantalla: el consumidor actualiza
// sus propios query params y el grid se re-pide en la misma página.

describe("SearchBar — mode=inline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Enter llama a onSubmit con el query trimeado y NO navega", () => {
    const onSubmit = vi.fn();
    render(
      <SearchBar mode="inline" defaultValue="  dune  " onSubmit={onSubmit} />
    );
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("dune");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Enter con el input vacío no llama a onSubmit", () => {
    const onSubmit = vi.fn();
    render(<SearchBar mode="inline" defaultValue="   " onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("vaciar el input llama a onClear (volver al catálogo sin pulsar Enter)", () => {
    const onClear = vi.fn();
    const onSubmit = vi.fn();
    render(
      <SearchBar
        mode="inline"
        defaultValue="dune"
        onSubmit={onSubmit}
        onClear={onClear}
      />
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(onClear).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("escribir texto no dispara onClear", () => {
    const onClear = vi.fn();
    render(
      <SearchBar mode="inline" onSubmit={vi.fn()} onClear={onClear} />
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "du" } });
    expect(onClear).not.toHaveBeenCalled();
  });

  it("Escape no envía ni navega", () => {
    const onSubmit = vi.fn();
    render(<SearchBar mode="inline" defaultValue="dune" onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
