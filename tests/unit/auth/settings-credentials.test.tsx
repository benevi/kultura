/**
 * Ajustes: cambiar email y contraseña (R1, art. 16 RGPD).
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateUser = vi.fn();

vi.mock("next-intl", async () => {
  const m = await import("./fake-auth");
  return { useTranslations: () => m.fakeT, useLocale: () => "es" };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/es/settings",
}));
vi.mock("@/components/ui/ToastProvider", () => ({
  useToastContext: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock("next/link", async () => {
  const m = await import("./fake-auth");
  return { default: m.FakeLink };
});
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser: mockUpdateUser, signOut: vi.fn() } }),
}));

import { SettingsForm } from "@/app/[locale]/(app)/settings/SettingsForm";

const PROPS = {
  initialUsername: "testuser",
  initialAvatarColor: "blue",
  initialAvatarIcon: null,
  initialLocale: "es",
  userEmail: "old@example.com",
};

function openEmailForm() {
  fireEvent.click(screen.getByRole("button", { name: "changeEmail" }));
}

describe("cambiar email", () => {
  beforeEach(() => mockUpdateUser.mockReset());

  it("envía updateUser con el email nuevo y vuelta a Ajustes", async () => {
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
    render(<SettingsForm {...PROPS} />);
    openEmailForm();
    fireEvent.change(screen.getByLabelText("newEmail"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "changeEmailSubmit" }));

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith(
        { email: "new@example.com" },
        {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
            "/es/settings?email=confirmed"
          )}`,
        }
      )
    );
    expect(await screen.findByRole("status")).toHaveTextContent("changeEmailSent:new@example.com");
  });

  it("valida el formato y que no sea el mismo, sin llamar a Supabase", async () => {
    render(<SettingsForm {...PROPS} />);
    openEmailForm();
    const input = screen.getByLabelText("newEmail");

    fireEvent.change(input, { target: { value: "no-es-email" } });
    fireEvent.click(screen.getByRole("button", { name: "changeEmailSubmit" }));
    expect(await screen.findByText("invalidEmail")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "OLD@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "changeEmailSubmit" }));
    expect(await screen.findByText("changeEmailSame")).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("un error de Supabase se muestra traducido", async () => {
    mockUpdateUser.mockResolvedValue({
      data: {},
      error: { message: "A user with this email address has already been registered", code: "email_exists" },
    });
    render(<SettingsForm {...PROPS} />);
    openEmailForm();
    fireEvent.change(screen.getByLabelText("newEmail"), { target: { value: "taken@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "changeEmailSubmit" }));
    expect(await screen.findByText("userAlreadyExists")).toBeInTheDocument();
  });

  it("a la vuelta del enlace avisa de que se confirmó", () => {
    render(<SettingsForm {...PROPS} emailConfirmed />);
    expect(screen.getByRole("status")).toHaveTextContent("emailConfirmed");
  });
});

describe("cambiar contraseña", () => {
  // Regresión: llevaba a `/login?mode=reset`, que solo volvía a pedir el
  // correo; no había forma de cambiarla.
  it("va a la pantalla de contraseña nueva con vuelta a Ajustes", () => {
    render(<SettingsForm {...PROPS} />);
    expect(screen.getByRole("link", { name: "changePassword" })).toHaveAttribute(
      "href",
      "/es/reset-password?next=%2Fes%2Fsettings"
    );
  });
});

describe("cuenta demo", () => {
  it("no ofrece cambiar email ni contraseña", () => {
    render(<SettingsForm {...PROPS} isDemo />);
    expect(screen.queryByRole("button", { name: "changeEmail" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "changePassword" })).not.toBeInTheDocument();
    expect(screen.getByText("demoCredentialsLocked")).toBeInTheDocument();
  });
});
