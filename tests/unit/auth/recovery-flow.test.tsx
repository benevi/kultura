/**
 * Recuperación completa con Supabase simulado (aceptación 2 de F-01):
 * enlace del correo → pantalla de contraseña nueva → entrar con la nueva.
 */
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createFakeAuth } from "./fake-auth";

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import("./fake-auth").createFakeAuth>,
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => h.fake.client }));
// El servidor canjea el token del correo: en el simulado, abre la sesión.
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: async ({ token_hash }: { token_hash: string }) => {
        if (token_hash !== "valid-token") return { error: { message: "x", code: "otp_expired" } };
        h.fake.openSessionFor("user@example.com", "SIGNED_IN");
        return { error: null };
      },
      exchangeCodeForSession: async () => ({ error: { message: "x" } }),
    },
  }),
}));
vi.mock("next-intl", async () => {
  const m = await import("./fake-auth");
  return { useTranslations: () => m.fakeT };
});
vi.mock("@/i18n/navigation", async () => {
  const m = await import("./fake-auth");
  return { Link: m.FakeLink };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => h.params,
}));

import { GET as callback } from "@/app/api/auth/callback/route";
import { ResetPasswordForm } from "@/app/[locale]/reset-password/ResetPasswordForm";
import { LoginPage } from "@/app/[locale]/login/LoginPage";

function typeIn(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  h.fake = createFakeAuth();
  h.fake.addAccount("user@example.com", "old-password");
  h.replace.mockReset();
  h.params = new URLSearchParams();
});

describe("recuperar la contraseña de principio a fin", () => {
  it("enlace → contraseña nueva → entrar con la nueva funciona y con la vieja no", async () => {
    // 1. El enlace del correo pasa por el callback y deja la sesión abierta.
    const res = await callback(
      new NextRequest("https://k.test/api/auth/callback?token_hash=valid-token&type=recovery&next=%2Fes%2Fhome")
    );
    expect(res.headers.get("location")).toBe("https://k.test/es/reset-password");
    expect(h.fake.session).not.toBeNull();

    // 2. Pantalla de contraseña nueva.
    render(<ResetPasswordForm locale="es" />);
    await screen.findByLabelText("newPassword");
    typeIn("newPassword", "new-password-1");
    typeIn("repeatPassword", "new-password-1");
    fireEvent.click(screen.getByRole("button", { name: "savePassword" }));
    expect(await screen.findByText("passwordUpdated")).toBeInTheDocument();
    expect(h.fake.auth.updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
    expect(h.fake.auth.signOut).toHaveBeenCalledWith({ scope: "others" });

    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    expect(h.replace).toHaveBeenCalledWith("/es/home");

    // 3. Cerrar sesión y entrar con la nueva.
    cleanup();
    h.fake.clearSession();
    h.replace.mockReset();
    render(<LoginPage locale="es" />);

    typeIn("email", "user@example.com");
    typeIn("password", "old-password");
    fireEvent.click(document.querySelector('button[type="submit"]')!);
    expect(await screen.findByText("invalidCredentials")).toBeInTheDocument();

    typeIn("password", "new-password-1");
    fireEvent.click(document.querySelector('button[type="submit"]')!);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/es/home"));
  });
});

describe("pantalla de contraseña nueva", () => {
  it("sin sesión → el enlace no sirve y se ofrece pedir otro", async () => {
    render(<ResetPasswordForm locale="es" />);
    expect(await screen.findByText("resetLinkInvalid")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "requestNewLink" })).toHaveAttribute(
      "href",
      "/login?mode=reset"
    );
  });

  it("la sesión que llega después (PASSWORD_RECOVERY) activa el formulario", async () => {
    render(<ResetPasswordForm locale="es" />);
    await screen.findByText("resetLinkInvalid");
    act(() => h.fake.openSessionFor("user@example.com", "PASSWORD_RECOVERY"));
    expect(await screen.findByLabelText("newPassword")).toBeInTheDocument();
  });

  it("valida longitud y que coincidan, con el foco en el campo", async () => {
    h.fake.openSessionFor("user@example.com");
    render(<ResetPasswordForm locale="es" />);
    await screen.findByLabelText("newPassword");

    typeIn("newPassword", "short");
    fireEvent.click(screen.getByRole("button", { name: "savePassword" }));
    expect(await screen.findByText("passwordTooShort")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText("newPassword"));

    typeIn("newPassword", "long-enough-1");
    typeIn("repeatPassword", "long-enough-2");
    fireEvent.click(screen.getByRole("button", { name: "savePassword" }));
    expect(await screen.findByText("passwordMismatch")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText("repeatPassword"));
    expect(h.fake.auth.updateUser).not.toHaveBeenCalled();
  });

  it("la misma contraseña de antes se explica", async () => {
    h.fake.openSessionFor("user@example.com");
    render(<ResetPasswordForm locale="es" />);
    await screen.findByLabelText("newPassword");
    typeIn("newPassword", "old-password");
    typeIn("repeatPassword", "old-password");
    fireEvent.click(screen.getByRole("button", { name: "savePassword" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("samePassword");
  });

  it("desde Ajustes vuelve a Ajustes", async () => {
    h.fake.openSessionFor("user@example.com", "SIGNED_IN");
    h.params = new URLSearchParams("next=%2Fen%2Fsettings");
    render(<ResetPasswordForm locale="en" />);
    await screen.findByLabelText("newPassword");
    typeIn("newPassword", "new-password-1");
    typeIn("repeatPassword", "new-password-1");
    fireEvent.click(screen.getByRole("button", { name: "savePassword" }));
    fireEvent.click(await screen.findByRole("button", { name: "continue" }));
    expect(h.replace).toHaveBeenCalledWith("/en/settings");
  });

  it("la cuenta demo no puede cambiarla", async () => {
    h.fake.addAccount("demo@example.com", "x", { app_metadata: { demo: true } });
    h.fake.openSessionFor("demo@example.com", "SIGNED_IN");
    render(<ResetPasswordForm locale="es" />);
    expect(await screen.findByText("demoNoPassword")).toBeInTheDocument();
    expect(screen.queryByLabelText("newPassword")).not.toBeInTheDocument();
  });
});
