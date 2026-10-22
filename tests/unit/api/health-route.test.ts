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

const { limitMock, selectMock, fromMock, probesMock } = vi.hoisted(() => {
  const limitMock = vi.fn();
  const selectMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const probesMock = vi.fn();
  return { limitMock, selectMock, fromMock, probesMock };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: fromMock })),
}));

// Las sondas de proveedores tienen su propio test; aquí solo cómo las usa la ruta.
vi.mock("@/app/api/health/providers", () => ({
  getProvidersReport: probesMock,
}));

const req = (ip = "1.2.3.4") =>
  new NextRequest("https://kultura.test/api/health", {
    headers: { "x-forwarded-for": ip },
  });

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue({ error: null, data: [{ id: "u1" }] });
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
    // COD-3: `users` es la tabla de perfiles; `profiles` no la crea ninguna
    // migración. GET con limit(1) (no HEAD): un 404 llega como error.
    expect(fromMock).toHaveBeenCalledWith("users");
    expect(selectMock).toHaveBeenCalledWith("id");
    expect(limitMock).toHaveBeenCalledWith(1);
  });

  it("tabla inexistente → 503 (antes el HEAD daba ok aunque no existiera)", async () => {
    limitMock.mockResolvedValue({
      data: null,
      error: { code: "42P01", message: 'relation "public.users" does not exist' },
    });
    const res = await GET(req("4.4.4.4"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, db: "down" });
  });

  it("nunca se cachea: si se cachease, el cron dejaría de tocar la base", async () => {
    expect(dynamic).toBe("force-dynamic");
    const res = await GET(req());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("base caída → 503 y ok:false, sin filtrar el error al cliente", async () => {
    limitMock.mockResolvedValue({
      data: null,
      error: { message: 'relation "users" does not exist' },
    });

    const res = await GET(req("5.6.7.8"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, db: "down" });
    // El detalle va al log del servidor, no a la respuesta pública.
    expect(JSON.stringify(body)).not.toContain("users");
  });

  it("una excepción del cliente tampoco tumba la ruta", async () => {
    limitMock.mockRejectedValue(new Error("fetch failed"));
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

  it("sin ?deep=1 no se llama a ningún proveedor", async () => {
    await GET(req("10.0.0.1"));
    expect(probesMock).not.toHaveBeenCalled();
  });

  describe("?deep=1", () => {
    const deepReq = (ip: string) =>
      new NextRequest("https://kultura.test/api/health?deep=1", {
        headers: { "x-forwarded-for": ip },
      });
    const provider = (ok: boolean) => ({ ok, ms: 10, circuit: "closed" });

    it("devuelve el estado de cada proveedor y ok:true si todo responde", async () => {
      probesMock.mockResolvedValue({
        ok: true,
        checkedAt: "2026-10-22T00:00:00.000Z",
        providers: { tmdb: provider(true), rawg: provider(true) },
      });
      const res = await GET(deepReq("11.0.0.1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.db).toBe("up");
      expect(Object.keys(body.providers)).toEqual(["tmdb", "rawg"]);
    });

    it("un proveedor caído → 200 (la base responde) pero ok:false", async () => {
      probesMock.mockResolvedValue({
        ok: false,
        checkedAt: "2026-10-22T00:00:00.000Z",
        providers: { tmdb: provider(true), anilist: { ...provider(false), error: "http", status: 403 } },
      });
      const res = await GET(deepReq("11.0.0.2"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.providers.anilist).toMatchObject({ ok: false, status: 403 });
    });

    it("base caída → 503 aunque los proveedores respondan", async () => {
      limitMock.mockResolvedValue({ data: null, error: { message: "down" } });
      probesMock.mockResolvedValue({ ok: true, checkedAt: "x", providers: {} });
      const res = await GET(deepReq("11.0.0.3"));
      expect(res.status).toBe(503);
      expect((await res.json()).ok).toBe(false);
    });

    it("si las sondas revientan, la ruta no se cae", async () => {
      probesMock.mockRejectedValue(new Error("boom"));
      const res = await GET(deepReq("11.0.0.4"));
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(false);
    });
  });
});
