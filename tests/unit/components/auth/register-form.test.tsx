import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignUp = vi.fn();
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockRouterPush = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      getSession: mockGetSession,
    },
  }),
}));

// useTranslations returns the key directly:
// useTranslations("auth")("confirmPassword") → "confirmPassword"
// useTranslations("errors")("passwordMismatch") → "passwordMismatch"
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/es/login",
}));

// useSearchParams mock — mode=register
const mockGet = vi.fn().mockReturnValue("register");
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { LoginPage } from "@/app/[locale]/login/LoginPage";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoginPage — modo register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue("register");
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignUp.mockReset();
  });

  it("renderiza campo de confirmación de contraseña", () => {
    render(<LoginPage locale="es" />);
    // label text = tAuth("confirmPassword") → "confirmPassword"
    expect(screen.getByLabelText("confirmPassword")).toBeInTheDocument();
  });

  it("renderiza los tres campos: email, password y confirmPassword", () => {
    render(<LoginPage locale="es" />);
    expect(screen.getByLabelText("email")).toBeInTheDocument();
    expect(screen.getByLabelText("password")).toBeInTheDocument();
    expect(screen.getByLabelText("confirmPassword")).toBeInTheDocument();
  });

  it("muestra error de validación si passwords no coinciden", async () => {
    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "differentpass" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // tErrors("passwordMismatch") → "passwordMismatch"
      expect(screen.getByText("passwordMismatch")).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("no llama a signUp cuando el email es inválido", async () => {
    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "invalidemail" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // tErrors("invalidEmail") → "invalidEmail"
      expect(screen.getByText("invalidEmail")).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("llama a signUp con email y password correctos cuando las validaciones pasan", async () => {
    mockSignUp.mockResolvedValue({
      error: null,
      data: { session: null, user: { id: "123" } },
    });

    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  it("muestra mensaje de verificación de email si no hay sesión después del registro", async () => {
    mockSignUp.mockResolvedValue({
      error: null,
      data: { session: null, user: { id: "123" } },
    });

    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // tAuth("checkEmail") → "checkEmail"
      expect(screen.getByText("checkEmail")).toBeInTheDocument();
    });
  });

  it("redirige a /home si hay sesión tras registro (auto-confirm)", async () => {
    mockSignUp.mockResolvedValue({
      error: null,
      data: { session: { access_token: "tok" }, user: { id: "123" } },
    });

    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/home");
    });
  });

  it("muestra error cuando signUp falla (usuario ya existente)", async () => {
    mockSignUp.mockResolvedValue({
      error: { message: "User already registered" },
      data: null,
    });

    render(<LoginPage locale="es" />);
    const submitBtn = document.querySelector('button[type="submit"]')!;

    fireEvent.change(screen.getByLabelText("email"), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText("password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("confirmPassword"), {
      target: { value: "password123" },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // tErrors("userAlreadyExists") → "userAlreadyExists"
      expect(screen.getByText("userAlreadyExists")).toBeInTheDocument();
    });
  });
});
