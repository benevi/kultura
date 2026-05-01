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
  it("renderiza el texto KULTURA", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    expect(screen.getByText("KULTURA")).toBeInTheDocument();
  });

  it("contiene un enlace al home (/)", async () => {
    const HeaderResolved = await Header();
    render(HeaderResolved);
    const homeLink = screen.getByText("KULTURA").closest("a");
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
});
