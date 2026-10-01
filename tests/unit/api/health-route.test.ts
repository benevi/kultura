// ============================================================
// KULTURA — GET /api/health (E-KEEPALIVE)
//
// Lo que se protege aquí NO es una feature visible: es que el cron diario siga
// TOCANDO la base. Si esta ruta dejase de consultar Supabase (por una caché
// mal puesta, por ejemplo), el keep-alive seguiría devolviendo 200 y pareceria
// funcionar hasta el día en que el proyecto se pausa igualmente.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, dynamic } from "@/app/api/health/route";

const { selectMock, fromMock } = vi.hoisted(() => {
  const selectMock = vi.fn();
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { selectMock, fromMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: fromMock })),
}));

const req = (ip = "1.2.3.4") =>
  new NextRequest("https://kultura.test/api/health", {
    headers: { "x-forwarded-for": ip },
  });

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockResolvedValue({ error: null, count: 1 });
  });

  it("base viva → 200 y ok:true", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe("up");
  });

  it("CONSULTA la base de verdad (es lo único que cuenta como actividad)", async () => {
    await GET(req());
    expect(fromMock).toHaveBeenCalledWith("profiles");
    // head:true → la petición viaja a Postgres pero no arrastra filas.
    expect(selectMock).toHaveBeenCalledWith("id", { count: "exact", head: true });
  });

  it("nunca se cachea: si se cachease, el cron dejaría de tocar la base", async () => {
    expect(dynamic).toBe("force-dynamic");
    const res = await GET(req());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("base caída → 503 y ok:false, sin filtrar el error al cliente", async () => {
    selectMock.mockResolvedValue({
      error: { message: 'relation "profiles" does not exist' },
    });

    const res = await GET(req("5.6.7.8"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, db: "down" });
    // El detalle va al log del servidor, no a la respuesta pública.
    expect(JSON.stringify(body)).not.toContain("profiles");
  });

  it("una excepción del cliente tampoco tumba la ruta", async () => {
    selectMock.mockRejectedValue(new Error("fetch failed"));
    const res = await GET(req("9.9.9.9"));
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
  });

  it("endpoint público pero con tope por IP", async () => {
    const ip = "7.7.7.7";
    // El tope es 30/min: la petición 31 desde la misma IP se rechaza.
    for (let i = 0; i < 30; i++) await GET(req(ip));
    const res = await GET(req(ip));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    // Otra IP sigue pasando: el tope no es global.
    expect((await GET(req("8.8.8.8"))).status).toBe(200);
  });
});
