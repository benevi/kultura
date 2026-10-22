/**
 * GET /api/auth/callback — canje del código o del token del correo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockExchange = vi.fn();
const mockVerifyOtp = vi.fn();
const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockUsersUpdate = vi.fn();
const usersUpdateChain = { eq: vi.fn(), is: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchange,
      verifyOtp: mockVerifyOtp,
      getUser: mockGetUser,
      updateUser: mockUpdateUser,
    },
    from: (table: string) => {
      if (table !== "users") throw new Error(`tabla inesperada ${table}`);
      return { update: mockUsersUpdate };
    },
  }),
}));

import { GET } from "@/app/api/auth/callback/route";

function call(query: string, cookie?: string) {
  const headers = cookie ? { cookie } : undefined;
  return GET(new NextRequest(`https://k.test/api/auth/callback${query}`, { headers }));
}

describe("callback de auth", () => {
  beforeEach(() => {
    mockExchange.mockReset();
    mockVerifyOtp.mockReset();
    mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: "u1", user_metadata: {} } } });
    mockUpdateUser.mockReset().mockResolvedValue({ data: {}, error: null });
    usersUpdateChain.eq.mockReset().mockReturnValue(usersUpdateChain);
    usersUpdateChain.is.mockReset().mockResolvedValue({ error: null });
    mockUsersUpdate.mockReset().mockReturnValue(usersUpdateChain);
  });

  it("canje correcto → destino saneado", async () => {
    mockExchange.mockResolvedValue({ error: null });
    const res = await call("?code=abc&next=%2Fen%2Flibrary");
    expect(res.headers.get("location")).toBe("https://k.test/en/library");
  });

  it("sin next → inicio del locale de la cookie", async () => {
    mockExchange.mockResolvedValue({ error: null });
    const res = await call("?code=abc", "NEXT_LOCALE=en");
    expect(res.headers.get("location")).toBe("https://k.test/en/home");
  });

  it("next externo → inicio", async () => {
    mockExchange.mockResolvedValue({ error: null });
    const res = await call("?code=abc&next=https%3A%2F%2Fevil.com");
    expect(res.headers.get("location")).toBe("https://k.test/es/home");
  });

  // Regresión R1(a): antes iba a `/login?error=…` sin locale y el login no
  // reconocía el error, así que el fallo era invisible.
  it("fallo del canje → login CON locale y código visible", async () => {
    mockExchange.mockResolvedValue({ error: { message: "boom" } });
    const res = await call("?code=abc&next=%2Fen%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/en/login?error=auth_callback_error");
  });

  it("PKCE sin verificador → aviso de otro navegador", async () => {
    // Código real de supabase-js (AuthPKCECodeVerifierMissingError).
    mockExchange.mockResolvedValue({ error: { message: "PKCE code verifier not found in storage.", code: "pkce_code_verifier_not_found" } });
    const res = await call("?code=abc&next=%2Fes%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/es/login?error=auth_link_other_browser");
  });

  it("Supabase devuelve el error en la URL (enlace caducado)", async () => {
    const res = await call("?error=access_denied&error_code=otp_expired&error_description=x&next=%2Fen%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/en/login?error=auth_link_expired");
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("sin código ni token → error genérico", async () => {
    const res = await call("");
    expect(res.headers.get("location")).toBe("https://k.test/es/login?error=auth_callback_error");
  });

  it("token_hash de recuperación → verifyOtp y SIEMPRE a la pantalla de contraseña nueva", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await call("?token_hash=th&type=recovery&next=%2Fen%2Fhome");
    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "th" });
    expect(res.headers.get("location")).toBe("https://k.test/en/reset-password");
  });

  it("token_hash de cambio de email → vuelve a Ajustes", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await call("?token_hash=th&type=email_change&next=%2Fes%2Fsettings%3Femail%3Dconfirmed");
    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "email_change", token_hash: "th" });
    expect(res.headers.get("location")).toBe("https://k.test/es/settings?email=confirmed");
  });

  it("tipo de token no admitido → error, sin llamar a Supabase", async () => {
    const res = await call("?token_hash=th&type=magiclink");
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://k.test/es/login?error=auth_callback_error");
  });

  it("token caducado → aviso de enlace caducado", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid", code: "otp_expired" } });
    const res = await call("?token_hash=th&type=recovery&next=%2Fes%2Freset-password");
    expect(res.headers.get("location")).toBe("https://k.test/es/login?error=auth_link_expired");
  });

  // Con "Secure email change", el primer enlace vuelve sin código y con un
  // `message`: no es un error.
  it("?message= sin código ni error → destino (cambio de email en dos pasos)", async () => {
    const res = await call(
      "?next=%2Fes%2Fsettings%3Femail%3Dconfirmed&message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email"
    );
    expect(res.headers.get("location")).toBe("https://k.test/es/settings?email=confirmed");
    expect(mockExchange).not.toHaveBeenCalled();
  });

  // Forma de las plantillas propias: `{{ .RedirectTo }}&token_hash=…&type=email`,
  // donde RedirectTo ya trae `?next=…`.
  it("plantilla de alta con RedirectTo + token_hash → verifyOtp(email) y next", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await call("?next=%2Fen%2Fu%2Fbenevi&token_hash=th&type=email");
    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "th" });
    expect(res.headers.get("location")).toBe("https://k.test/en/u/benevi");
  });

  it("si Supabase lanza en vez de devolver el error, también vuelve al login", async () => {
    mockExchange.mockRejectedValue({ message: "PKCE code verifier not found in storage.", code: "pkce_code_verifier_not_found" });
    const res = await call("?code=abc&next=%2Fes%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/es/login?error=auth_link_other_browser");
  });

  describe("personaje elegido en el alta", () => {
    it("se aplica al perfil sin personaje y se borra de los metadatos", async () => {
      mockVerifyOtp.mockResolvedValue({ error: null });
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: { avatar_icon: "panda" } } } });
      const res = await call("?next=%2Fes%2Fhome&token_hash=th&type=email");
      expect(mockUsersUpdate).toHaveBeenCalledWith({ avatar_icon: "panda" });
      expect(usersUpdateChain.eq).toHaveBeenCalledWith("id", "u1");
      expect(usersUpdateChain.is).toHaveBeenCalledWith("avatar_icon", null);
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { avatar_icon: null } });
      expect(res.headers.get("location")).toBe("https://k.test/es/home");
    });

    it("un personaje inválido no se escribe (pero se limpia)", async () => {
      mockExchange.mockResolvedValue({ error: null });
      mockGetUser.mockResolvedValue({ data: { user: { id: "u1", user_metadata: { avatar_icon: "<script>" } } } });
      await call("?code=abc");
      expect(mockUsersUpdate).not.toHaveBeenCalled();
      expect(mockUpdateUser).toHaveBeenCalledWith({ data: { avatar_icon: null } });
    });

    it("sin personaje en los metadatos no toca nada", async () => {
      mockExchange.mockResolvedValue({ error: null });
      await call("?code=abc");
      expect(mockUsersUpdate).not.toHaveBeenCalled();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("la cuenta demo no escribe", async () => {
      mockExchange.mockResolvedValue({ error: null });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "d", app_metadata: { demo: true }, user_metadata: { avatar_icon: "panda" } } },
      });
      await call("?code=abc");
      expect(mockUsersUpdate).not.toHaveBeenCalled();
    });

    it("un fallo al aplicarlo no impide entrar", async () => {
      mockVerifyOtp.mockResolvedValue({ error: null });
      mockGetUser.mockRejectedValue(new Error("red"));
      const res = await call("?next=%2Fes%2Fhome&token_hash=th&type=email");
      expect(res.headers.get("location")).toBe("https://k.test/es/home");
    });
  });
});
