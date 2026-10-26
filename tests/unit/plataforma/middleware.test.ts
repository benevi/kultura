/**
 * Tests unitarios — middleware: cabeceras de plataforma.
 *
 * - SEG-4a: cualquier petición con cabecera `Next-Action` se corta con 400
 *   antes de tocar Supabase (la app no usa Server Actions; cierra la vía de
 *   DoS de Next 14 hasta la actualización a Next 15).
 * - SEG-10: el nonce viaja en la cabecera de la PETICIÓN (la que lee Next para
 *   firmar sus scripts), nunca en la de la respuesta.
 * - `x-pathname`: la ruta y la query originales viajan a los Server Components
 *   en la cabecera de la petición (la usa el layout de `(app)` para el `next`).
 * - D-02 (F-22): las rutas cacheables (portada, rankings, legales, /offline)
 *   no llevan CSP del middleware (la fija la pone next.config.mjs), ni
 *   consultan la sesión, ni mandan cookies; sin cookie `sb-` tampoco se
 *   consulta Auth en el resto.
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

// next-intl importa `next/server` sin extensión y Node ESM no lo resuelve en
// vitest con Next 14. El doble reproduce lo que hace su `next()` real
// (dist/esm/.../middleware.js): copia las cabeceras de la petición y añade la
// del locale.
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return {
    default: () => (request: NextRequest) => {
      const headers = new Headers(request.headers);
      headers.set("X-NEXT-INTL-LOCALE", "es");
      const res = NextResponse.next({ request: { headers } });
      // Como el real en producción: recuerda el idioma con una cookie.
      res.cookies.set("NEXT_LOCALE", "es");
      return res;
    },
  };
});

function req(method: string, path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://kultura.test${path}`, { method, headers });
}

/** Petición de alguien con la sesión abierta (cookie de Supabase). */
const SESSION = { cookie: "sb-proyecto-auth-token=token" };

/** Cabecera que Next reenvía a la petición (NextResponse.next({ request })). */
function forwarded(res: Response, name: string) {
  return res.headers.get(`x-middleware-request-${name}`);
}

beforeEach(() => {
  getUser.mockClear();
});

describe("SEG-4a — Server Actions bloqueadas", () => {
  it("POST con Next-Action a una página → 400 sin cuerpo", async () => {
    const res = await middleware(req("POST", "/es", { "Next-Action": "abc123" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("");
  });

  it("la cabecera se reconoce sin importar mayúsculas ni método ni ruta", async () => {
    for (const [method, path] of [
      ["POST", "/api/library"],
      ["GET", "/en/best/movie/2026"],
      ["PUT", "/"],
    ] as const) {
      const res = await middleware(req(method, path, { "next-action": "x" }));
      expect(res.status).toBe(400);
    }
  });

  it("corta antes de consultar la sesión (no gasta una llamada a Supabase)", async () => {
    await middleware(req("POST", "/es", { "Next-Action": "abc123" }));
    expect(getUser).not.toHaveBeenCalled();
  });

  it("sin la cabecera la petición sigue su curso", async () => {
    const res = await middleware(req("POST", "/api/library", SESSION));
    expect(res.status).not.toBe(400);
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});

describe("SEG-10 — x-nonce fuera de la respuesta", () => {
  it.each(["/es", "/es/library", "/api/discover"])("%s: la respuesta no lleva x-nonce", async (path) => {
    const res = await middleware(req("GET", path));
    expect(res.headers.get("x-nonce")).toBeNull();
  });

  it.each(["/es/library", "/es/login", "/es/u/benevi", "/api/discover"])(
    "%s: el nonce de la CSP de la respuesta llega a la petición",
    async (path) => {
      const res = await middleware(req("GET", path));
      const csp = res.headers.get("content-security-policy") ?? "";
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce).toBeTruthy();
      expect(forwarded(res, "x-nonce")).toBe(nonce);
      expect(forwarded(res, "content-security-policy")).toBe(csp);
    }
  );
});

describe("x-pathname en la petición", () => {
  it("página: ruta + query originales", async () => {
    const res = await middleware(req("GET", "/es/library?status=watching&page=2"));
    expect(forwarded(res, "x-pathname")).toBe("/es/library?status=watching&page=2");
  });

  it("API: también se reenvía", async () => {
    const res = await middleware(req("GET", "/api/search?q=dune"));
    expect(forwarded(res, "x-pathname")).toBe("/api/search?q=dune");
  });

  it("un x-pathname enviado por el cliente se sobrescribe", async () => {
    const res = await middleware(
      req("GET", "/es/library", { "x-pathname": "https://evil.example/" })
    );
    expect(forwarded(res, "x-pathname")).toBe("/es/library");
  });

  it("la respuesta al navegador no expone x-pathname", async () => {
    const res = await middleware(req("GET", "/es/library"));
    expect(res.headers.get("x-pathname")).toBeNull();
  });
});

describe("D-02 — rutas cacheables en el CDN", () => {
  const STATIC = [
    "/es",
    "/en",
    "/es/best",
    "/es/best/anime",
    "/es/best/movie/2026",
    "/en/best/game/2025",
    "/es/privacy",
    "/en/terms",
    "/es/legal",
    "/es/accessibility",
    "/es/offline",
  ];
  const DYNAMIC = [
    "/es/login",
    "/es/u/benevi",
    "/es/media/movie/603",
    "/es/home",
    "/es/welcome",
    "/es/report",
    "/es/reset-password",
    "/es/bestias",
    "/api/discover",
  ];

  it.each(STATIC)("%s: sin CSP del middleware ni nonce en la petición", async (path) => {
    const res = await middleware(req("GET", path, SESSION));
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(forwarded(res, "content-security-policy")).toBeNull();
    expect(forwarded(res, "x-nonce")).toBeNull();
  });

  it.each(STATIC)("%s: no consulta la sesión aunque haya cookie", async (path) => {
    await middleware(req("GET", path, SESSION));
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each(STATIC)("%s: la respuesta no manda cookies (las sacaría de la caché)", async (path) => {
    const res = await middleware(req("GET", path, SESSION));
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sigue pasando por next-intl (idioma) y por x-pathname", async () => {
    const res = await middleware(req("GET", "/es/best/movie/2026?utm_source=x"));
    expect(forwarded(res, "x-next-intl-locale")).toBe("es");
    expect(forwarded(res, "x-pathname")).toBe("/es/best/movie/2026?utm_source=x");
  });

  it.each(DYNAMIC)("%s: conserva la CSP con nonce", async (path) => {
    const res = await middleware(req("GET", path, SESSION));
    expect(res.headers.get("content-security-policy")).toMatch(/script-src 'self' 'nonce-[^']+'/);
  });
});

describe("F-22 — sin cookie de Supabase no se consulta Auth", () => {
  it("visitante anónimo en una página dinámica: ninguna llamada a getUser", async () => {
    const res = await middleware(req("GET", "/es/login"));
    expect(getUser).not.toHaveBeenCalled();
    expect(res.headers.get("content-security-policy")).toMatch(/'nonce-/);
  });

  it("visitante anónimo en la API: tampoco", async () => {
    await middleware(req("GET", "/api/search?q=dune"));
    expect(getUser).not.toHaveBeenCalled();
  });

  it("con la cookie (aunque vaya troceada en .0/.1) sí se valida la sesión", async () => {
    await middleware(
      req("GET", "/es/home", { cookie: "sb-proyecto-auth-token.0=a; sb-proyecto-auth-token.1=b" })
    );
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("otras cookies no cuentan como sesión", async () => {
    await middleware(req("GET", "/es/home", { cookie: "NEXT_LOCALE=es; _vercel=1" }));
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe("F-22 — /api/csp-report no pasa por la sesión", () => {
  it("con cookie de sesión tampoco consulta Auth (los informes llegan solos y a ráfagas)", async () => {
    const res = await middleware(req("POST", "/api/csp-report", SESSION));
    expect(getUser).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
