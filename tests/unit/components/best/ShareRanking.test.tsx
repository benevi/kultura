import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShareRanking } from "@/components/best/ShareRanking";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    key === "shareText" ? `${params?.title}: ranking` : key,
}));

describe("ShareRanking", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("X abre el intent con el texto y la URL completa del ranking", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ShareRanking path="/es/best/anime/2026" title="Los mejores animes de 2026" />);
    fireEvent.click(screen.getByText("X"));
    const url = String(open.mock.calls[0][0]);
    expect(url).toContain("https://x.com/intent/post?text=");
    expect(url).toContain(encodeURIComponent("Los mejores animes de 2026: ranking"));
    expect(url).toContain(encodeURIComponent("/es/best/anime/2026"));
  });

  it("sin hoja nativa copia el enlace y lo indica", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ShareRanking path="/es/best/movie/2025" title="Pelis" />);
    fireEvent.click(screen.getByText("share"));
    await waitFor(() => expect(screen.getByText("copied")).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/es/best/movie/2025"));
  });
});
