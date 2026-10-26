import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-intl server functions
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "es"),
  getTranslations: vi.fn(async () => (key: string) => {
    const map: Record<string, string> = {
      signIn: "Iniciar sesión",
      signUp: "Registrarse",
    };
    return map[key] ?? key;
  }),
}));

// REN-9: la cabecera pública pinta `<a>` del servidor, no el `Link` de
// next-intl (arrastraba al JS de la portada los trozos de la cabecera con
// sesión, Supabase incluido). Si se vuelve a importar, el test falla.
vi.mock("@/i18n/navigation", () => {
  throw new Error("Header no debe importar @/i18n/navigation (REN-9)");
});

// Mock Button to render as simple element for easier testing
vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    variant?: string;
    size?: string;
  }) => {
    if (asChild && children) {
      return <>{children}</>;
    }
    return <button>{children}</button>;
  },
}));

import { Header } from "@/components/layout/Header";

describe("Header", () => {
  it("renderiza el texto kultura (wordmark del logo)", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    expect(screen.getByText("kultura")).toBeInTheDocument();
  });

  it("contiene un enlace a la portada del idioma (/es)", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const homeLink = screen.getByText("kultura").closest("a");
    expect(homeLink).toHaveAttribute("href", "/es");
  });

  it("con `locale` explícito los enlaces llevan ese idioma (páginas estáticas)", async () => {
    render(await Header({ locale: "en" }));
    expect(screen.getByText("kultura").closest("a")).toHaveAttribute("href", "/en");
    expect(screen.getByRole("link", { name: /registrarse/i })).toHaveAttribute("href", "/en/login?mode=register");
  });

  it("renderiza enlace de Iniciar sesión hacia /login?mode=login", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const signInLink = screen.getByRole("link", { name: /iniciar sesión/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute("href", "/es/login?mode=login");
  });

  it("renderiza enlace de Registrarse hacia /login?mode=register", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const signUpLink = screen.getByRole("link", { name: /registrarse/i });
    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute("href", "/es/login?mode=register");
  });

  it("la cabecera es opaca, como la de la app (antes bg-surface/80 no generaba regla y era transparente)", async () => {
    const HeaderResolved = await Header();
    const { container } = render(HeaderResolved);
    const header = container.querySelector("header")!;
    expect(header).toHaveClass("bg-surface-default");
    expect(header.className).not.toMatch(/bg-surface\/80|backdrop-blur/);
  });

  it("cabe en 320 px: botones compactos en móvil y etiqueta corta de entrar por debajo de 360 px", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const signIn = screen.getByRole("link", { name: /iniciar sesión/i });
    expect(signIn.className).toMatch(/\bh-9\b/);
    expect(signIn.className).toMatch(/\bsm:h-10\b/);
    expect(screen.getByText("Iniciar sesión")).toHaveClass("max-[359px]:hidden");
    expect(screen.getByText("signInAction")).toHaveClass("min-[360px]:hidden");
  });
});
