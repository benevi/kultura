import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SalaLink } from "@/components/sala/SalaLink";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `(${ns}.${key})`,
}));

// El enlace interno es el de next-intl: aquí, un <a> marcado para reconocerlo.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={href} data-i18n-link="" {...rest}>
      {children}
    </a>
  ),
}));

describe("SalaLink", () => {
  describe("interno", () => {
    it("usa el enlace con idioma del repo y no abre pestaña", () => {
      render(<SalaLink href="/library">Tu biblioteca</SalaLink>);
      const enlace = screen.getByRole("link", { name: "Tu biblioteca" });
      expect(enlace).toHaveAttribute("href", "/library");
      expect(enlace).toHaveAttribute("data-i18n-link");
      expect(enlace).not.toHaveAttribute("target");
      expect(enlace).not.toHaveAttribute("rel");
    });
  });

  describe("externo", () => {
    it.each(["https://www.themoviedb.org/movie/496243", "http://example.org", "//example.org/x"])(
      "%s: <a> a secas, pestaña nueva y rel seguro",
      (href) => {
        render(<SalaLink href={href}>Ver en TMDB</SalaLink>);
        const enlace = screen.getByRole("link");
        expect(enlace).toHaveAttribute("href", href);
        expect(enlace).not.toHaveAttribute("data-i18n-link");
        expect(enlace).toHaveAttribute("target", "_blank");
        expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
      }
    );

    it("dice en el nombre que se abre en otra pestaña y lo marca con un icono de adorno", () => {
      render(<SalaLink href="https://www.themoviedb.org">Ver en TMDB</SalaLink>);
      // La librería de pruebas recorta el espacio que separa el aviso; el navegador lo conserva.
      const enlace = screen.getByRole("link", { name: /^Ver en TMDB ?\(common\.newTab\)$/ });
      expect(enlace.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("newTab={false}: misma pestaña, sin aviso, y sigue sin dar el referente", () => {
      render(
        <SalaLink href="https://www.themoviedb.org" newTab={false}>
          Ver en TMDB
        </SalaLink>
      );
      const enlace = screen.getByRole("link", { name: "Ver en TMDB" });
      expect(enlace).not.toHaveAttribute("target");
      expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
      expect(enlace.querySelector("svg")).toBeNull();
    });

    it("un rel propio se suma al seguro", () => {
      render(
        <SalaLink href="https://example.org" rel="nofollow">
          Fuente
        </SalaLink>
      );
      expect(screen.getByRole("link")).toHaveAttribute("rel", "nofollow noopener noreferrer");
    });
  });

  it.each(["mailto:hola@example.org", "tel:+34900000000", "#creditos"])("%s: <a> a secas en la misma pestaña", (href) => {
    render(<SalaLink href={href}>Enlace</SalaLink>);
    const enlace = screen.getByRole("link", { name: "Enlace" });
    expect(enlace).not.toHaveAttribute("data-i18n-link");
    expect(enlace).not.toHaveAttribute("target");
    expect(enlace).not.toHaveAttribute("rel");
  });

  describe("aspecto", () => {
    it("en línea: subrayado siempre (no se distingue solo por el color) y foco de «Sala»", () => {
      render(<SalaLink href="/library">Tu biblioteca</SalaLink>);
      const { className } = screen.getByRole("link");
      expect(className).toMatch(/(^|\s)underline(\s|$)/);
      expect(className).toContain("sala-focused:sala-focus");
      expect(className).not.toContain("min-h-sala-target");
    });

    it("suelto: 48 px de alto y el texto subrayado", () => {
      render(
        <SalaLink href="/library" variant="standalone">
          Ver toda la biblioteca
        </SalaLink>
      );
      const enlace = screen.getByRole("link", { name: "Ver toda la biblioteca" });
      expect(enlace.className).toContain("min-h-sala-target");
      expect(screen.getByText("Ver toda la biblioteca").className).toMatch(/(^|\s)underline(\s|$)/);
    });

    it("pasa lang, className y el resto de atributos", () => {
      render(
        <SalaLink href="/media/129" lang="ja" className="mt-4" aria-current="page">
          千と千尋の神隠し
        </SalaLink>
      );
      const enlace = screen.getByRole("link", { name: "千と千尋の神隠し" });
      expect(enlace).toHaveAttribute("lang", "ja");
      expect(enlace).toHaveAttribute("aria-current", "page");
      expect(enlace.className).toContain("mt-4");
    });
  });
});
