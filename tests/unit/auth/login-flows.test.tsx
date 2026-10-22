/**
 * Login: recuperación, reenvío, `next`, errores del callback, navegadores
 * integrados y comportamiento sin JS (F-01).
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFakeAuth } from "./fake-auth";

const h = vi.hoisted(() => ({
  fake: null as unknown as ReturnType<typeof import("./fake-auth").createFakeAuth>,
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => h.fake.client }));
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

import { LoginPage, RESEND_COOLDOWN_SECONDS } from "@/app/[locale]/login/LoginPage";

const ORIGIN = window.location.origin;

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function submit() {
  fireEvent.click(document.querySelector('button[type="submit"]')!);
}

beforeEach(() => {
  h.fake = createFakeAuth();
  h.replace.mockReset();
  h.params = new URLSearchParams();
});

describe("recuperación de contraseña (R1)", () => {
  // Regresión: el enlace volvía a `/login?mode=reset`, que solo pedía el
  // correo otra vez; no existía ninguna pantalla que cambiase la contraseña.
  it("el enlace del correo lleva a la pantalla de contraseña nueva", async () => {
    h.params = new URLSearchParams("mode=reset");
    render(<LoginPage locale="en" />);
    type("email", "user@example.com");
    submit();
    await waitFor(() =>
      expect(h.fake.auth.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
        redirectTo: `${ORIGIN}/api/auth/callback?next=%2Fen%2Freset-password`,
      })
    );
    expect(await screen.findByText("resetSentBody:user@example.com")).toBeInTheDocument();
  });

  // Los correos ya enviados con el formato antiguo aterrizan aquí con la
  // sesión abierta: se les lleva a la pantalla nueva.
  it("mode=reset con sesión → /{locale}/reset-password", async () => {
    h.fake.addAccount("user@example.com", "password123");
    h.fake.openSessionFor("user@example.com");
    h.params = new URLSearchParams("mode=reset");
    render(<LoginPage locale="es" />);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/es/reset-password"));
  });

  it("el evento PASSWORD_RECOVERY también lleva a la pantalla nueva", async () => {
    h.fake.addAccount("user@example.com", "password123");
    h.params = new URLSearchParams("mode=reset");
    render(<LoginPage locale="es" />);
    await waitFor(() => expect(h.fake.auth.onAuthStateChange).toHaveBeenCalled());
    act(() => h.fake.openSessionFor("user@example.com", "PASSWORD_RECOVERY"));
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/es/reset-password"));
  });
});

describe("Revisa tu correo: reenviar (ROJO-2)", () => {
  afterEach(() => vi.useRealTimers());

  it("el reenvío espera 60 s y luego llama a auth.resend con el callback", async () => {
    // El reloj falso avanza también solo, para que findBy/waitFor sigan
    // funcionando; la cuenta atrás se adelanta a mano.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.fake.requireEmailConfirmation(true);
    h.params = new URLSearchParams("mode=register");
    render(<LoginPage locale="es" />);
    type("email", "new@example.com");
    type("password", "password123");
    fireEvent.click(screen.getByRole("checkbox")); // SEG-7: edad y términos
    submit();
    await screen.findByText("checkEmail");

    const button = screen.getByRole("button", { name: `resendIn:${RESEND_COOLDOWN_SECONDS}` });
    expect(button).toBeDisabled();
    for (let i = 0; i < RESEND_COOLDOWN_SECONDS; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    vi.useRealTimers();

    const ready = screen.getByRole("button", { name: "resend" });
    expect(ready).not.toBeDisabled();
    fireEvent.click(ready);
    await waitFor(() =>
      expect(h.fake.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "new@example.com",
        options: { emailRedirectTo: `${ORIGIN}/api/auth/callback?next=%2Fes%2Fhome` },
      })
    );
    expect(await screen.findByText("resent")).toBeInTheDocument();
  });

  it("'Email not confirmed' al entrar ofrece reenviar la confirmación", async () => {
    h.fake.addAccount("pending@example.com", "password123", { confirmed: false });
    render(<LoginPage locale="es" />);
    type("email", "pending@example.com");
    type("password", "password123");
    submit();
    expect(await screen.findByText("emailNotConfirmed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "resendConfirmation" }));
    await waitFor(() => expect(h.fake.auth.resend).toHaveBeenCalled());
    expect(await screen.findByText("checkEmail")).toBeInTheDocument();
  });

  it("el SMTP por defecto ('not authorized') se explica en vez de 'Algo salió mal'", async () => {
    h.params = new URLSearchParams("mode=reset");
    h.fake.auth.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { message: "Email address not authorized", code: "email_address_not_authorized" },
    } as never);
    render(<LoginPage locale="es" />);
    type("email", "someone@example.com");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("emailNotAuthorized");
  });
});

describe("destino `next` (CRE-5)", () => {
  it("tras entrar vuelve a la página de origen", async () => {
    h.fake.addAccount("user@example.com", "password123");
    h.params = new URLSearchParams("next=%2Fes%2Flibrary");
    render(<LoginPage locale="es" />);
    type("email", "user@example.com");
    type("password", "password123");
    submit();
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/es/library"));
  });

  it("un next externo se ignora", async () => {
    h.fake.addAccount("user@example.com", "password123");
    h.params = new URLSearchParams("next=https%3A%2F%2Fevil.com");
    render(<LoginPage locale="es" />);
    type("email", "user@example.com");
    type("password", "password123");
    submit();
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/es/home"));
  });

  it("Google y el cambio de modo conservan el next", async () => {
    h.params = new URLSearchParams("next=%2Fen%2Fu%2Fbenevi");
    render(<LoginPage locale="en" />);
    expect(screen.getByRole("link", { name: "signUpAction" })).toHaveAttribute(
      "href",
      "/login?mode=register&next=%2Fen%2Fu%2Fbenevi"
    );
    fireEvent.click(screen.getByRole("button", { name: /continueWithGoogle/ }));
    await waitFor(() =>
      expect(h.fake.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${ORIGIN}/api/auth/callback?next=%2Fen%2Fu%2Fbenevi` },
      })
    );
  });

  it("con sesión abierta, entrar redirige al destino tras pintar", async () => {
    h.fake.addAccount("user@example.com", "password123");
    h.fake.openSessionFor("user@example.com", "SIGNED_IN");
    h.params = new URLSearchParams("next=%2Fes%2Flists");
    render(<LoginPage locale="es" />);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/es/lists"));
  });
});

describe("errores del callback (R1a)", () => {
  it.each([
    ["auth_callback_error", "authCallbackError"],
    ["auth_link_other_browser", "authLinkOtherBrowser"],
    ["auth_link_expired", "authLinkExpired"],
  ])("?error=%s se muestra como %s", async (code, key) => {
    h.params = new URLSearchParams(`error=${code}`);
    render(<LoginPage locale="es" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(key);
  });

  it("un ?error= desconocido no pinta nada", () => {
    h.params = new URLSearchParams("error=lo_que_sea");
    render(<LoginPage locale="es" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("accesibilidad del formulario (ACC-3)", () => {
  it("al fallar la validación el foco va al primer campo inválido", async () => {
    render(<LoginPage locale="es" />);
    type("password", "password123");
    submit();
    await screen.findByText("invalidEmail");
    expect(document.activeElement).toBe(screen.getByLabelText("email"));
    expect(screen.getByLabelText("email")).toHaveAttribute("aria-invalid", "true");
  });

  it("email y contraseña son obligatorios para el lector", () => {
    render(<LoginPage locale="es" />);
    expect(screen.getByLabelText("email")).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText("password")).toHaveAttribute("aria-required", "true");
  });

  it("el error de Supabase va en role=alert", async () => {
    h.fake.addAccount("user@example.com", "password123");
    render(<LoginPage locale="es" />);
    type("email", "user@example.com");
    type("password", "otherpass1");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("invalidCredentials");
  });

  it("'Revisa tu correo' va en role=status y recibe el foco", async () => {
    h.params = new URLSearchParams("mode=reset");
    render(<LoginPage locale="es" />);
    type("email", "user@example.com");
    submit();
    const heading = await screen.findByRole("heading", { name: "checkEmail" });
    expect(screen.getByRole("status")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("enlace de vuelta a la portada (DIS-13)", () => {
    render(<LoginPage locale="es" />);
    expect(screen.getByRole("link", { name: "backHome" })).toHaveAttribute("href", "/");
  });
});

describe("sin JS (ROJO-10)", () => {
  // Lo que ve el navegador antes de hidratar: inputs con `name` y el envío
  // bloqueado, para que el formulario no recargue con los datos en la URL.
  it("el HTML del servidor trae name en los inputs y el envío desactivado", () => {
    const html = renderToString(<LoginPage locale="es" />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector('input[name="email"]')).not.toBeNull();
    expect(doc.querySelector('input[name="password"]')).not.toBeNull();
    expect(doc.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(true);
    expect(doc.querySelector("form")?.getAttribute("method")).toBe("post");
  });

  it("tras hidratar el envío se activa", () => {
    render(<LoginPage locale="es" />);
    expect(document.querySelector('button[type="submit"]')).not.toBeDisabled();
  });
});

describe("navegador integrado de apps sociales (MOV-11)", () => {
  const realUA = window.navigator.userAgent;
  function setUA(ua: string) {
    Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
  }
  afterEach(() => setUA(realUA));

  it("en Instagram (iOS) avisa y ofrece copiar el enlace", async () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Instagram 300.0");
    render(<LoginPage locale="es" />);
    expect(await screen.findByText("inAppTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "inAppCopy" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "inAppOpenChrome" })).not.toBeInTheDocument();
  });

  it("en TikTok (Android) ofrece abrir en Chrome", async () => {
    setUA("Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/120 Mobile musical_ly_2023");
    render(<LoginPage locale="es" />);
    const link = await screen.findByRole("link", { name: "inAppOpenChrome" });
    expect(link.getAttribute("href")).toMatch(/^intent:\/\/.*package=com\.android\.chrome/);
  });

  it("en un navegador normal no avisa", () => {
    setUA("Mozilla/5.0 (Macintosh) AppleWebKit Safari/605");
    render(<LoginPage locale="es" />);
    expect(screen.queryByText("inAppTitle")).not.toBeInTheDocument();
  });
});
