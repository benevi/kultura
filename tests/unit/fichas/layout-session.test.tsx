// ============================================================
// F-15 · La ficha con sesión se ve dentro de la app: AuthHeader y BottomNav
// (envoltorio real `AppChrome`, sesión simulada de Supabase).
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { session, redirect } = vi.hoisted(() => ({
  session: { user: null as null | { id: string; email: string } },
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: session.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: session.user ? { id: session.user.id, username: "ana", avatar_color: "blue", avatar_initials: "AN" } : null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/social/notifications", () => ({ getUnreadCount: async () => 2 }));
vi.mock("@/components/layout/AuthHeader", () => ({
  AuthHeader: ({ unreadCount }: { unreadCount: number }) => <header data-testid="auth-header" data-unread={unreadCount} />,
}));
vi.mock("@/components/layout/BottomNav", () => ({
  BottomNav: ({ username }: { username: string }) => <nav data-testid="bottom-nav" data-username={username} />,
}));
vi.mock("@/components/layout/AppFooter", () => ({ AppFooter: () => <footer data-testid="app-footer" /> }));
vi.mock("@/components/ui/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/layout/UnreadChatProvider", () => ({
  UnreadChatProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/layout/DemoBanner", () => ({ DemoBanner: () => null }));
vi.mock("@/lib/demo", () => ({ isDemoUser: () => false }));
vi.mock("@/components/layout/Header", () => ({ Header: () => <header data-testid="public-header" /> }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer data-testid="public-footer" /> }));
vi.mock("@/i18n/ClientMessages", () => ({
  ClientMessages: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import MediaLayout from "@/app/[locale]/media/layout";

beforeEach(() => {
  session.user = null;
  redirect.mockReset();
});

describe("media/layout con el envoltorio real", () => {
  it("con sesión: AuthHeader (con avisos) y BottomNav, sin cabecera pública", async () => {
    session.user = { id: "u1", email: "ana@x.es" };
    render(await MediaLayout({ children: <p data-testid="page">ficha</p> }));
    expect(screen.getByTestId("auth-header")).toHaveAttribute("data-unread", "2");
    expect(screen.getByTestId("bottom-nav")).toHaveAttribute("data-username", "ana");
    expect(screen.getByTestId("app-footer")).toBeInTheDocument();
    expect(screen.queryByTestId("public-header")).not.toBeInTheDocument();
    expect(screen.getByTestId("page")).toBeInTheDocument();
  });

  it("sin sesión: cabecera pública y nunca redirige", async () => {
    render(await MediaLayout({ children: <p data-testid="page">ficha</p> }));
    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.queryByTestId("auth-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
