// ============================================================
// F-29 · "Compartir mi nota" (CRE-8a)
// ============================================================

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ shareNative: vi.fn() }));
vi.mock("@/components/pwa/share", () => ({ shareNative: h.shareNative }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    key === "text" ? `Le doy ${values?.rating} a ${values?.title} en KULTURA` : key,
}));

import { ShareRatingButton } from "@/components/media/ShareRatingButton";

const PATH = "/es/u/ana/r/movie/550?s=abcdefghijklmnopqrstuv&ref=ana";

beforeEach(() => {
  h.shareNative.mockReset();
});

describe("ShareRatingButton", () => {
  it("hoja nativa con el enlace FIRMADO absoluto y el texto con la nota", async () => {
    h.shareNative.mockResolvedValue("shared");
    render(<ShareRatingButton path={PATH} title="Fight Club" rating="9/10" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "action" })));
    expect(h.shareNative).toHaveBeenCalledWith({
      title: "Fight Club",
      text: "Le doy 9/10 a Fight Club en KULTURA",
      url: `${window.location.origin}${PATH}`,
    });
    expect(screen.getByRole("button", { name: "action" })).toHaveAttribute("aria-expanded", "false");
  });

  it("sin hoja nativa: menú con copiar (avisa en aria-live), X y WhatsApp", async () => {
    h.shareNative.mockResolvedValue("unavailable");
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<ShareRatingButton path={PATH} title="Fight Club" rating="9/10" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "action" })));
    expect(screen.getByRole("button", { name: "action" })).toHaveAttribute("aria-expanded", "true");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "copy" })));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${PATH}`);
    expect(screen.getByRole("status")).toHaveTextContent("copied");

    fireEvent.click(screen.getByRole("button", { name: "onX" }));
    const xUrl = new URL(open.mock.calls[0][0] as string);
    expect(xUrl.origin).toBe("https://x.com");
    expect(xUrl.searchParams.get("text")).toBe("Le doy 9/10 a Fight Club en KULTURA");
    expect(xUrl.searchParams.get("url")).toBe(`${window.location.origin}${PATH}`);
    fireEvent.click(screen.getByRole("button", { name: "onWhatsApp" }));
    expect(open.mock.calls[1][0]).toContain("https://wa.me/?text=");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "action" })).toHaveAttribute("aria-expanded", "false");
    open.mockRestore();
  });
});
