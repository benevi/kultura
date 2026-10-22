/**
 * GET /api/auth/callback — canje del código o del token del correo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockExchange = vi.fn();
const mockVerifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { exchangeCodeForSession: mockExchange, verifyOtp: mockVerifyOtp },
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
    mockExchange.mockResolvedValue({ error: { message: "x", code: "bad_code_verifier" } });
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
});
