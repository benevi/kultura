import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SynopsisSection } from "@/components/media/SynopsisSection";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe("SynopsisSection: la nota del idioma en «Sala» (F6)", () => {
  it("en «Sala», con la sinopsis en otro idioma, lo dice", () => {
    render(<SynopsisSection text="A hobbit." lang="en" langName="inglés" variant="sala" />);
    expect(screen.getByText('salaSynopsisLanguage:{"language":"inglés"}')).toBeInTheDocument();
    expect(screen.getByText("A hobbit.")).toHaveAttribute("lang", "en");
  });

  it("sin idioma distinto, o en la ficha vieja, no hay nota", () => {
    const { container, unmount } = render(<SynopsisSection text="Un hobbit." variant="sala" langName="inglés" />);
    expect(container.querySelector("[data-sala-synopsis-lang]")).toBeNull();
    unmount();
    const old = render(<SynopsisSection text="A hobbit." lang="en" langName="inglés" />);
    expect(old.container.querySelector("[data-sala-synopsis-lang]")).toBeNull();
  });
});
