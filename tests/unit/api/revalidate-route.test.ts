// KULTURA — POST /api/revalidate (F-06, COD-9)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST } from "@/app/api/revalidate/route";
import { revalidateTag } from "next/cache";
import { _resetStoreForTests } from "@/lib/rate-limit";

const SECRET = "s3cret-de-prueba";
const post = (auth?: string, body?: unknown) =>
  new NextRequest("http://localhost/api/revalidate", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  _resetStoreForTests();
  process.env.REVALIDATE_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.REVALIDATE_SECRET;
});

describe("POST /api/revalidate", () => {
  it("sin REVALIDATE_SECRET configurado la ruta no existe", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(post(`Bearer ${SECRET}`));
    expect(res.status).toBe(404);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("sin secreto o con uno incorrecto → 401", async () => {
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post("Bearer otro"))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("con el secreto, vacía best-of por defecto", async () => {
    const res = await POST(post(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("best-of");
    expect((await res.json()).revalidated).toEqual(["best-of"]);
  });

  it("acepta solo etiquetas conocidas", async () => {
    const okRes = await POST(post(`Bearer ${SECRET}`, { tags: ["best-of", "showcase"] }));
    expect(okRes.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("showcase");

    vi.mocked(revalidateTag).mockClear();
    const bad = await POST(post(`Bearer ${SECRET}`, { tags: ["users"] }));
    expect(bad.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("limita los intentos por IP", async () => {
    for (let i = 0; i < 10; i++) await POST(post("Bearer otro"));
    expect((await POST(post(`Bearer ${SECRET}`))).status).toBe(429);
  });
});
