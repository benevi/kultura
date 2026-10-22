/**
 * F-12 (CRE-6): las cuentas nuevas que vuelven por el callback (correo
 * confirmado o primera vez con Google) pasan por /welcome con su destino.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  account: { data: null as unknown, error: null as unknown },
  exchange: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: h.exchange,
      verifyOtp: h.verifyOtp,
      getUser: async () => ({ data: { user: h.user } }),
      updateUser: async () => ({ data: {}, error: null }),
    },
    from: (table: string) => {
      if (table === "account_state") {
        const c = { select: () => c, eq: () => c, maybeSingle: async () => h.account };
        return c;
      }
      const u = { update: () => u, eq: () => u, is: async () => ({ error: null }) };
      return u;
    },
  }),
}));

import { GET } from "@/app/api/auth/callback/route";

const call = (query: string) => GET(new NextRequest(`https://k.test/api/auth/callback${query}`));
const recent = () => new Date(Date.now() - 60_000).toISOString();

describe("callback → onboarding (F-12)", () => {
  beforeEach(() => {
    h.exchange.mockReset().mockResolvedValue({ error: null });
    h.verifyOtp.mockReset().mockResolvedValue({ error: null });
    h.user = { id: "u1", created_at: recent(), app_metadata: {}, user_metadata: {} };
    h.account = { data: { onboarded_at: null }, error: null };
  });

  it("cuenta sin onboarding (Google) → /welcome con el destino", async () => {
    const res = await call("?code=abc&next=%2Fen%2Fu%2Fbenevi");
    expect(res.headers.get("location")).toBe("https://k.test/en/welcome?next=%2Fen%2Fu%2Fbenevi");
  });

  it("correo de alta confirmado (token_hash) → /welcome", async () => {
    const res = await call("?token_hash=t&type=signup&next=%2Fes%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/es/welcome?next=%2Fes%2Fhome");
  });

  it("cuenta que ya hizo el onboarding → directo al destino", async () => {
    h.account = { data: { onboarded_at: "2026-10-01T00:00:00Z" }, error: null };
    const res = await call("?code=abc&next=%2Fes%2Flibrary");
    expect(res.headers.get("location")).toBe("https://k.test/es/library");
  });

  it("la recuperación de contraseña nunca pasa por /welcome", async () => {
    const res = await call("?token_hash=t&type=recovery");
    expect(res.headers.get("location")).toBe("https://k.test/es/reset-password");
  });

  it("la demo nunca pasa por /welcome", async () => {
    h.user = { ...h.user!, app_metadata: { demo: true } };
    const res = await call("?code=abc&next=%2Fes%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/es/home");
  });

  it("sin la tabla (migración sin aplicar): cuenta recién creada → /welcome", async () => {
    h.account = { data: null, error: { code: "PGRST205" } };
    const res = await call("?code=abc&next=%2Fes%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/es/welcome?next=%2Fes%2Fhome");
  });

  it("sin la tabla: cuenta antigua → destino", async () => {
    h.account = { data: null, error: { code: "PGRST205" } };
    h.user = { ...h.user!, created_at: "2026-01-01T00:00:00Z" };
    const res = await call("?code=abc&next=%2Fes%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/es/home");
  });

  it("sin la tabla pero ya terminó (app_metadata.onboarded_at) → destino", async () => {
    h.account = { data: null, error: { code: "PGRST205" } };
    h.user = { ...h.user!, app_metadata: { onboarded_at: "2026-10-22T00:00:00Z" } };
    const res = await call("?code=abc&next=%2Fes%2Fhome");
    expect(res.headers.get("location")).toBe("https://k.test/es/home");
  });
});
