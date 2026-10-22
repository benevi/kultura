import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-intl server functions
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const map: Record<string, string> = {
      signIn: "Iniciar sesión",
      signUp: "Registrarse",
    };
    return map[key] ?? key;
  }),
}));

// Mock @/i18n/navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

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

  it("contiene un enlace al home (/)", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const homeLink = screen.getByText("kultura").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renderiza enlace de Iniciar sesión hacia /login?mode=login", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const signInLink = screen.getByRole("link", { name: /iniciar sesión/i });
    expect(signInLink).toBeInTheDocument();
    expect(signInLink).toHaveAttribute("href", "/login?mode=login");
  });

  it("renderiza enlace de Registrarse hacia /login?mode=register", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const signUpLink = screen.getByRole("link", { name: /registrarse/i });
    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute("href", "/login?mode=register");
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
