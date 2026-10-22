import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeAuth } from "../../auth/fake-auth";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import("../../auth/fake-auth").createFakeAuth>,
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => h.fake.client }));

vi.mock("next-intl", async () => {
  const m = await import("../../auth/fake-auth");
  return { useTranslations: () => m.fakeT };
});

vi.mock("@/i18n/navigation", async () => {
  const m = await import("../../auth/fake-auth");
  return { Link: m.FakeLink };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => h.params,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { LoginPage } from "@/app/[locale]/login/LoginPage";
import { TERMS_VERSION } from "@/app/api/settings/identity";

function fillAndSubmit(email: string, password: string, { terms = true } = {}) {
  fireEvent.change(screen.getByLabelText("email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("password"), { target: { value: password } });
  // SEG-7: casilla obligatoria de edad y términos.
  if (terms) fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(document.querySelector('button[type="submit"]')!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoginPage — modo register", () => {
  beforeEach(() => {
    h.fake = createFakeAuth();
    h.replace.mockReset();
    h.params = new URLSearchParams("mode=register");
  });

  // CRE-5: un solo campo de contraseña, con mostrar/ocultar.
  it("no pide confirmar la contraseña y permite mostrarla", () => {
    render(<LoginPage locale="es" />);
    expect(screen.queryByLabelText("confirmPassword")).not.toBeInTheDocument();
    const input = screen.getByLabelText("password");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "showPasswordLabel" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "hidePasswordLabel" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("lleva línea de valor y enlaces a términos y privacidad en la casilla", () => {
    render(<LoginPage locale="es" />);
    expect(screen.getByText("valueLine")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "privacy" })).toHaveAttribute("href", "/privacy");
  });

  // SEG-7: sin la casilla no hay alta, y el error lleva el foco a la casilla.
  it("no se puede registrar sin marcar la casilla de edad y términos", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "password123", { terms: false });
    await waitFor(() => expect(screen.getByText("termsRequired")).toBeInTheDocument());
    const box = screen.getByRole("checkbox");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveFocus();
    expect(h.fake.auth.signUp).not.toHaveBeenCalled();
  });

  it("marcar la casilla quita el error", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "password123", { terms: false });
    await screen.findByText("termsRequired");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.queryByText("termsRequired")).not.toBeInTheDocument();
  });

  it("en el modo entrar no hay casilla", () => {
    h.params = new URLSearchParams();
    render(<LoginPage locale="es" />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("Google va antes que el formulario", () => {
    render(<LoginPage locale="es" />);
    const google = screen.getByRole("button", { name: /continueWithGoogle/ });
    const email = screen.getByLabelText("email");
    expect(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("no llama a signUp cuando el email es inválido", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("invalidemail", "password123");
    await waitFor(() => expect(screen.getByText("invalidEmail")).toBeInTheDocument());
    expect(h.fake.auth.signUp).not.toHaveBeenCalled();
  });

  // Regresión R2: `signUp` no pasaba `emailRedirectTo` y el enlace de
  // confirmación volvía a la Site URL sin canjear el código.
  it("llama a signUp con emailRedirectTo al callback y el idioma en los metadatos", async () => {
    render(<LoginPage locale="en" />);
    fillAndSubmit("user@example.com", "password123");
    await waitFor(() => {
      expect(h.fake.auth.signUp).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=%2Fen%2Fhome`,
          // SEG-7: el disparador convierte esto en terms_accepted_at.
          data: { locale: "en", terms_accepted: true, terms_version: TERMS_VERSION },
        },
      });
    });
  });

  // El personaje viaja en los metadatos: si la confirmación se abre en otro
  // navegador, el callback lo aplica (el localStorage no está allí).
  it("el personaje elegido va en options.data del signUp", async () => {
    render(<LoginPage locale="es" />);
    fireEvent.click(screen.getByRole("radio", { name: "panda" }));
    fillAndSubmit("user@example.com", "password123");
    await waitFor(() =>
      expect(h.fake.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: { locale: "es", terms_accepted: true, terms_version: TERMS_VERSION, avatar_icon: "panda" },
          }),
        })
      )
    );
  });

  it("sin sesión tras el registro → 'Revisa tu correo' con el email y reenviar", async () => {
    h.fake.requireEmailConfirmation(true);
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "password123");

    await waitFor(() => expect(screen.getByText("checkEmail")).toBeInTheDocument());
    expect(screen.getByText("checkEmailBody:user@example.com")).toBeInTheDocument();
    expect(screen.getByText("checkSpam")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resendIn:60/ })).toBeDisabled();
    expect(h.replace).not.toHaveBeenCalled();
  });

  // CRE-6: el alta inmediata pasa por el onboarding, que termina en el destino.
  it("con sesión tras el registro (confirmación desactivada) → onboarding con el destino", async () => {
    h.params = new URLSearchParams("mode=register&next=%2Fes%2Fu%2Fbenevi%2Fl%2F3");
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "password123");
    await waitFor(() =>
      expect(h.replace).toHaveBeenCalledWith("/es/welcome?next=%2Fes%2Fu%2Fbenevi%2Fl%2F3")
    );
  });

  it("muestra error cuando signUp falla (usuario ya existente)", async () => {
    h.fake.addAccount("existing@example.com", "password123");
    render(<LoginPage locale="es" />);
    fillAndSubmit("existing@example.com", "password123");
    await waitFor(() => expect(screen.getByText("userAlreadyExists")).toBeInTheDocument());
  });
});
