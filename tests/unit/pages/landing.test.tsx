import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock next-intl server
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      landing: {
        "hero.tagline": "Descubre, registra y comparte tu cultura",
        "hero.cta": "Empieza gratis",
        "what.title": "Todo tu universo cultural, en un solo lugar",
        "what.description": "Lleva el registro de las películas que has visto",
        "features.title": "Todo lo que necesitas",
        "features.library": "Biblioteca personal",
        "features.libraryDesc": "Registra lo que has visto",
        "features.friends": "Conecta con amigos",
        "features.friendsDesc": "Ve qué están disfrutando",
        "features.lists": "Listas colaborativas",
        "features.listsDesc": "Crea listas con amigos",
        "features.ai": "Recomendaciones IA",
        "features.aiDesc": "Descubre tu próximo favorito",
        "cta.title": "Únete a KULTURA",
        "cta.subtitle": "Empieza gratis. Sin tarjeta de crédito.",
        "cta.button": "Crear cuenta gratis",
      },
    };
    return (key: string) => messages[namespace]?.[key] ?? key;
  }),
}));

// Mock @/i18n/navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock layout components to isolate page under test
vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="mock-header" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer" />,
}));

// Mock Button component
vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => {
    if (asChild) return <>{children}</>;
    return <button>{children}</button>;
  },
}));

import HomePage from "@/app/[locale]/page";

describe("Landing page", () => {
  it("renderiza sin lanzar errores", async () => {
    const PageResolved = await HomePage();
    expect(() => render(PageResolved)).not.toThrow();
  });

  it("muestra el tagline del hero", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(
      screen.getByText("Descubre, registra y comparte tu cultura")
    ).toBeInTheDocument();
  });

  it("muestra el título de la sección what", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(
      screen.getByText("Todo tu universo cultural, en un solo lugar")
    ).toBeInTheDocument();
  });

  it("muestra el título de la sección features", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.getByText("Todo lo que necesitas")).toBeInTheDocument();
  });

  it("muestra el título del CTA final", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.getByText("Únete a KULTURA")).toBeInTheDocument();
  });

  it("contiene el Header mockeado", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
  });

  it("contiene el Footer mockeado", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
  });

  it("los botones CTA apuntan a /login?mode=register", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    const ctaLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/login?mode=register");
    expect(ctaLinks.length).toBeGreaterThanOrEqual(2);
  });
});
