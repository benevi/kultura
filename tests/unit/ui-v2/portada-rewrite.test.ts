import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200, headers: { "x-intl": "1" } }),
}));

import { middleware } from "@/middleware";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie: `ui_v2=${cookie}` } } : undefined);
const rewrittenTo = (res: Response) => res.headers.get("x-middleware-rewrite");

describe("portada en el middleware (D-H2)", () => {
  it.each(["/es", "/en", "/es/"])("%s con la cookie de la v2 sigue siendo la landing: no se reescribe", async (path) => {
    const res = await middleware(req(path, "1"));
    expect(rewrittenTo(res)).toBeNull();
  });

  it("la respuesta no lleva Set-Cookie: la portada sigue siendo cacheable", async () => {
    const res = await middleware(req("/es", "1"));
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sin cookie, o con la cookie a 0, la misma landing", async () => {
    expect(rewrittenTo(await middleware(req("/es")))).toBeNull();
    expect(rewrittenTo(await middleware(req("/es", "0")))).toBeNull();
  });

  it("la ruta interna no se sirve directamente", async () => {
    const res = await middleware(req("/es/portada-v2", "1"));
    expect(rewrittenTo(res)).toContain("/es/no-existe");
  });

  it("con UI_V2_DEFAULT=1 tampoco se reescribe", async () => {
    vi.stubEnv("UI_V2_DEFAULT", "1");
    try {
      expect(rewrittenTo(await middleware(req("/es")))).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("portada-v2 directa", () => {
  it("responde con la CSP con nonce, como cualquier 404", async () => {
    const res = await middleware(req("/en/portada-v2"));
    expect(rewrittenTo(res)).toContain("/en/no-existe");
    expect(res.headers.get("content-security-policy")).toContain("nonce-");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
