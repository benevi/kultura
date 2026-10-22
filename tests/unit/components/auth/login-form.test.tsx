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

// useTranslations(...) devuelve la clave → texto de la etiqueta = "email", etc.
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
// Import component under test (after mocks are set up)
// ---------------------------------------------------------------------------

import { LoginPage } from "@/app/[locale]/login/LoginPage";

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("password"), { target: { value: password } });
  fireEvent.click(document.querySelector('button[type="submit"]')!);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoginPage — modo login", () => {
  beforeEach(() => {
    h.fake = createFakeAuth();
    h.fake.addAccount("user@example.com", "password123");
    h.replace.mockReset();
    h.params = new URLSearchParams();
  });

  it("renderiza campos de email y password", () => {
    render(<LoginPage locale="es" />);
    expect(screen.getByLabelText("email")).toBeInTheDocument();
    expect(screen.getByLabelText("password")).toBeInTheDocument();
  });

  it("renderiza el botón de submit", () => {
    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]');
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn?.textContent).toBe("signIn");
  });

  it("muestra error de validación cuando el email es inválido", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("notanemail", "password123");
    await waitFor(() => expect(screen.getByText("invalidEmail")).toBeInTheDocument());
    expect(h.fake.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("muestra error de validación cuando la contraseña es muy corta", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "abc");
    await waitFor(() => expect(screen.getByText("passwordTooShort")).toBeInTheDocument());
    expect(h.fake.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("muestra error cuando signInWithPassword falla", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "wrongpass1");
    await waitFor(() => expect(screen.getByText("invalidCredentials")).toBeInTheDocument());
  });

  it("llama a signInWithPassword con email y password correctos", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "password123");
    await waitFor(() => {
      expect(h.fake.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  it("redirige al inicio con locale tras login exitoso", async () => {
    render(<LoginPage locale="es" />);
    fillAndSubmit("user@example.com", "password123");
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/es/home"));
  });

  // ── Acabado F0 del artboard Login (canvas "Kultura — Diseño completo") ──
  //
  // El encabezado visible se quitó (decisión del usuario), pero la página sigue
  // teniendo un <h1> para lectores de pantalla.
  it("conserva un h1 accesible aunque el encabezado no se vea", () => {
    render(<LoginPage locale="es" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("welcomeBack");
  });

  // El artboard pone el cambio de modo AL PIE ("¿No tienes cuenta?
  // Regístrate"). Ahora es un enlace de verdad (ROJO-10).
  it("ofrece el registro al pie como enlace a mode=register", () => {
    render(<LoginPage locale="es" />);
    expect(screen.getByText("dontHaveAccount")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "signUpAction" })).toHaveAttribute(
      "href",
      "/login?mode=register"
    );
  });

  it("muestra el enlace de olvidaste contraseña", () => {
    render(<LoginPage locale="es" />);
    expect(screen.getByRole("link", { name: "forgotPassword" })).toHaveAttribute(
      "href",
      "/login?mode=reset"
    );
  });

  // Regresión: se priorizaba NEXT_PUBLIC_SITE_URL (dominio canónico de
  // producción) sobre el origen real, así que iniciar sesión desde un preview
  // de Vercel o desde localhost terminaba autenticando en producción y la
  // sesión nunca volvía al despliegue que se estaba probando.
  it("OAuth vuelve al origen REAL del navegador, no al dominio canónico", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kultura-six.vercel.app");

    render(<LoginPage locale="es" />);
    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => {
      expect(h.fake.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=%2Fes%2Fhome`,
        },
      });
    });

    vi.unstubAllEnvs();
  });
});

describe("LoginPage — vuelta desde la demo (E-DEMO)", () => {
  beforeEach(() => {
    h.fake = createFakeAuth();
    h.params = new URLSearchParams("error=demo_unavailable");
  });

  // `/api/auth/demo` redirige aquí con ?error=demo_unavailable si la demo no
  // está configurada o se pasa del límite: el aviso tiene que verse, y no
  // borrarlo el reseteo de formulario que corre al montar.
  it("enseña el aviso de demo no disponible", async () => {
    render(<LoginPage locale="es" />);
    await waitFor(() => expect(screen.getByText("demoUnavailable")).toBeInTheDocument());
  });
});
