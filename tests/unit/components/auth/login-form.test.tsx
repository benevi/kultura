import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignInWithPassword = vi.fn();
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockRouterPush = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      getSession: mockGetSession,
    },
  }),
}));

// useTranslations("auth") returns (key) => key  →  label text = "email", "password", etc.
// useTranslations("errors") returns (key) => key → error text = "invalidEmail", etc.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/es/login",
}));

// useSearchParams mock — default to mode=login
const mockGet = vi.fn().mockReturnValue("login");
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

// ---------------------------------------------------------------------------
// Import component under test (after mocks are set up)
// ---------------------------------------------------------------------------

import { LoginPage } from "@/app/[locale]/login/LoginPage";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoginPage — modo login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue("login");
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithPassword.mockReset();
  });

  it("renderiza campos de email y password", () => {
    render(<LoginPage locale="es" />);
    // useTranslations returns key directly → label text = "email", "password"
    expect(screen.getByLabelText("email")).toBeInTheDocument();
    expect(screen.getByLabelText("password")).toBeInTheDocument();
  });

  it("renderiza el botón de submit", () => {
    render(<LoginPage locale="es" />);
    // The submit button has type="submit"; tab buttons have type="button"
    // Use querySelector to avoid ambiguity with tab button that also says "signIn"
    const submitBtn = document.querySelector('button[type="submit"]');
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn?.textContent).toBe("signIn");
  });

  it("muestra error de validación cuando el email es inválido", async () => {
    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "notanemail" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // tErrors("invalidEmail") → "invalidEmail"
      expect(screen.getByText("invalidEmail")).toBeInTheDocument();
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("muestra error de validación cuando la contraseña es muy corta", async () => {
    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "abc" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // tErrors("passwordTooShort") → "passwordTooShort"
      expect(screen.getByText("passwordTooShort")).toBeInTheDocument();
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("muestra error cuando signInWithPassword falla", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // tErrors("invalidCredentials") → "invalidCredentials"
      expect(screen.getByText("invalidCredentials")).toBeInTheDocument();
    });
  });

  it("llama a signInWithPassword con email y password correctos", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null, data: {} });
    mockRouterPush.mockReturnValue(undefined);

    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  it("redirige a /home tras login exitoso", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null, data: {} });

    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/home");
    });
  });

  it("muestra el enlace de olvidaste contraseña", () => {
    render(<LoginPage locale="es" />);
    // tAuth("forgotPassword") → "forgotPassword"
    expect(
      screen.getByRole("button", { name: "forgotPassword" })
    ).toBeInTheDocument();
  });
});
