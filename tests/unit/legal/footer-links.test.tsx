// @vitest-environment jsdom
/**
 * C14: una sola lista de enlaces legales para los pies, y un solo pie para la
 * landing y las cuñas (`LandingFooter`), con `<a>` (REN-9).
 */
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { legalFooterLinks } from "@/lib/legal/footer-links";
import { LandingFooter } from "@/components/landing/LandingFooter";

const t = (key: string) => `[${key}]`;

describe("legalFooterLinks", () => {
  it("da los cuatro documentos en el orden de los pies", () => {
    expect(legalFooterLinks(t)).toEqual([
      { key: "privacy", href: "/privacy", text: "[nav.privacy]" },
      { key: "terms", href: "/terms", text: "[nav.terms]" },
      { key: "notice", href: "/legal", text: "[nav.notice]" },
      { key: "accessibility", href: "/accessibility", text: "[nav.accessibility]" },
    ]);
  });

  it("con `only` filtra sin cambiar el orden", () => {
    expect(legalFooterLinks(t, ["terms", "privacy"]).map((l) => l.href)).toEqual(["/privacy", "/terms"]);
  });
});

describe("LandingFooter", () => {
  const copy = {
    nav: "Información",
    links: legalFooterLinks(t),
    otherLocale: { href: "/en/series", text: "English", lang: "en" },
    attribution: <p data-testid="attr" />,
  };

  it("enlaza los legales con el idioma y el otro idioma con hreflang", () => {
    render(<LandingFooter copy={copy} base="/es" />);
    const nav = screen.getByRole("navigation", { name: "Información" });
    expect(Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([
      "/es/privacy",
      "/es/terms",
      "/es/legal",
      "/es/accessibility",
      "/en/series",
    ]);
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("hreflang", "en");
    expect(screen.getByTestId("attr")).toBeInTheDocument();
  });

  it("solo la portada lleva la palabra gigante", () => {
    const { container, rerender } = render(<LandingFooter copy={copy} base="/es" />);
    expect(container.querySelector(".kl-fword")).toBeNull();
    rerender(<LandingFooter copy={copy} base="/es" bigWord />);
    expect(container.querySelector(".kl-fword")).toHaveAttribute("aria-hidden", "true");
  });

  it("pinta enlaces normales: no carga el Link de next-intl (REN-9)", () => {
    const source = readFileSync("src/components/landing/LandingFooter.tsx", "utf8");
    expect(source).not.toMatch(/@\/i18n\/navigation/);
  });
});
