import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShareRanking } from "@/components/best/ShareRanking";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    key === "text" ? `${params?.title}: ranking` : key,
}));

const setShare = (value: unknown) =>
  Object.defineProperty(navigator, "share", { value, configurable: true });

describe("ShareRanking (DIS-10, ACC-10)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setShare(undefined);
  });

  it("un solo botón Compartir dentro de un grupo con nombre", () => {
    render(<ShareRanking path="/es/best/anime/2026" title="Los mejores animes de 2026" />);
    const group = screen.getByRole("group", { name: "label" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "action" })).toHaveLength(1);
    // El menú no está desplegado: X y WhatsApp no se ven.
    expect(screen.queryByRole("button", { name: "onX" })).toBeNull();
  });

  it("con hoja nativa la usa con título, texto y URL completa", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    render(<ShareRanking path="/es/best/anime/2026" title="Animes" />);
    fireEvent.click(screen.getByRole("button", { name: "action" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0]).toMatchObject({ title: "Animes", text: "Animes: ranking" });
    expect(share.mock.calls[0][0].url).toContain("/es/best/anime/2026");
    expect(screen.getByRole("button", { name: "action" })).toHaveAttribute("aria-expanded", "false");
  });

  it("sin hoja nativa despliega el menú; X lleva nombre accesible y abre el intent", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ShareRanking path="/es/best/anime/2026" title="Los mejores animes de 2026" />);
    const toggle = screen.getByRole("button", { name: "action" });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
    fireEvent.click(screen.getByRole("button", { name: "onX" }));
    const url = String(open.mock.calls[0][0]);
    expect(url).toContain("https://x.com/intent/post?text=");
    expect(url).toContain(encodeURIComponent("Los mejores animes de 2026: ranking"));
    expect(url).toContain(encodeURIComponent("/es/best/anime/2026"));
    expect(screen.getByRole("button", { name: "onWhatsApp" })).toBeInTheDocument();
  });

  it("copiar enlace lo indica en una región de estado", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ShareRanking path="/es/best/movie/2025" title="Pelis" />);
    fireEvent.click(screen.getByRole("button", { name: "action" }));
    fireEvent.click(await screen.findByRole("button", { name: "copy" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("copied"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/es/best/movie/2025"));
  });

  it("Esc cierra el menú y devuelve el foco al botón", async () => {
    render(<ShareRanking path="/es/best/movie/2025" title="Pelis" />);
    const toggle = screen.getByRole("button", { name: "action" });
    fireEvent.click(toggle);
    await screen.findByRole("button", { name: "copy" });
    // El oyente de teclado se registra en un efecto tras abrir el menú: con la
    // CI cargada el menú puede verse antes. Se repite la tecla hasta que el
    // efecto esté activo; la aserción no cambia.
    await waitFor(() => {
      fireEvent.keyDown(document, { key: "Escape" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });
    await waitFor(() => expect(document.activeElement).toBe(toggle));
  });

  it("cancelar la hoja nativa no abre el menú", async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException("x", "AbortError")));
    render(<ShareRanking path="/es/best/movie/2025" title="Pelis" />);
    fireEvent.click(screen.getByRole("button", { name: "action" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("button", { name: "action" })).toHaveAttribute("aria-expanded", "false");
  });
});
