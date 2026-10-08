/**
 * Tests unitarios — cuenta demo de solo lectura (E-DEMO).
 *
 * La capa de API: el middleware tiene que rechazar las escrituras de una
 * sesión demo (las rutas que escriben con el cliente admin ignoran RLS, así
 * que la migración no las cubre) y dejar pasar todo lo demás.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { isBlockedForDemo, isDemoUser } from "@/lib/demo";
import { isDemoRejection } from "@/components/layout/DemoBanner";

let currentUser: { id: string; app_metadata: Record<string, unknown> } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser }, error: null }) },
  }),
}));

// La rama de páginas (next-intl) no interesa aquí: solo las rutas /api/.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return { default: () => () => NextResponse.next() };
});

const DEMO = { id: "d", app_metadata: { demo: true } };
const NORMAL = { id: "n", app_metadata: {} };

function req(method: string, path: string) {
  return new NextRequest(`http://localhost${path}`, { method });
}

describe("isDemoUser", () => {
  it("solo con app_metadata.demo === true", () => {
    expect(isDemoUser(DEMO)).toBe(true);
    expect(isDemoUser(NORMAL)).toBe(false);
    expect(isDemoUser({ app_metadata: { demo: "true" } })).toBe(false);
    expect(isDemoUser(null)).toBe(false);
  });
});

describe("isBlockedForDemo", () => {
  it("bloquea escrituras a la API y deja las lecturas", () => {
    expect(isBlockedForDemo("POST", "/api/library")).toBe(true);
    expect(isBlockedForDemo("delete", "/api/account")).toBe(true);
    expect(isBlockedForDemo("GET", "/api/library")).toBe(false);
  });

  it("deja entrar y salir de la demo", () => {
    expect(isBlockedForDemo("POST", "/api/auth/demo")).toBe(false);
    expect(isBlockedForDemo("POST", "/api/auth/demo/exit")).toBe(false);
  });
});

describe("middleware con sesión demo", () => {
  beforeEach(() => {
    currentUser = null;
  });

  it("rechaza con 403 una escritura de la demo", async () => {
    currentUser = DEMO;
    const res = await middleware(req("POST", "/api/library"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "demo_read_only" });
  });

  it("deja leer a la demo", async () => {
    currentUser = DEMO;
    const res = await middleware(req("GET", "/api/library"));
    expect(res.status).not.toBe(403);
  });

  it("no toca a un usuario normal", async () => {
    currentUser = NORMAL;
    const res = await middleware(req("DELETE", "/api/account"));
    expect(res.status).not.toBe(403);
  });

  it("la demo puede salir para registrarse", async () => {
    currentUser = DEMO;
    const res = await middleware(req("POST", "/api/auth/demo/exit"));
    expect(res.status).not.toBe(403);
  });
});

describe("isDemoRejection (toast del aviso)", () => {
  it("reconoce el 403 del middleware y el de la base", () => {
    expect(isDemoRejection("POST", "/api/library", 403)).toBe(true);
    expect(isDemoRejection("PATCH", "https://x.supabase.co/rest/v1/users?id=eq.1", 403)).toBe(true);
  });

  it("ignora lecturas y otros errores", () => {
    expect(isDemoRejection("GET", "/api/library", 403)).toBe(false);
    expect(isDemoRejection("POST", "/api/library", 500)).toBe(false);
  });
});
