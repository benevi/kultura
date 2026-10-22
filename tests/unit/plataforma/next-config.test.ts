/**
 * Tests unitarios — next.config.mjs (cabeceras estáticas y peso de Sentry).
 * Se importa la configuración real (ya envuelta por next-intl y Sentry).
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };
type Config = { poweredByHeader?: boolean; headers: () => Promise<Rule[]> };

let config: Config;
let rules: Rule[];
let clientSentryDefines: (isServer: boolean) => Record<string, boolean> | null;

beforeAll(async () => {
  const mod = await import("../../../next.config.mjs");
  config = mod.default as unknown as Config;
  clientSentryDefines = mod.clientSentryDefines;
  rules = await config.headers();
});

function headersFor(source: string) {
  return rules.find((r) => r.source === source)?.headers ?? [];
}

function value(source: string, key: string) {
  return headersFor(source).find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;
}

describe("SEG-10 — cabeceras", () => {
  it("sin X-Powered-By", () => {
    expect(config.poweredByHeader).toBe(false);
  });

  it("Cross-Origin-Opener-Policy: same-origin en todas las rutas", () => {
    expect(value("/(.*)", "Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("se mantienen las cabeceras que ya había", () => {
    expect(value("/(.*)", "X-Content-Type-Options")).toBe("nosniff");
    expect(value("/(.*)", "X-Frame-Options")).toBe("SAMEORIGIN");
    expect(value("/(.*)", "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});

describe("REN-10 — favicon cacheable", () => {
  it("favicon.ico con Cache-Control público de al menos un día", () => {
    const cc = value("/favicon.ico", "Cache-Control") ?? "";
    expect(cc).toContain("public");
    const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(86400);
  });
});

describe("REN-2 — Sentry ligero solo en el bundle del navegador", () => {
  it("cliente: fuera el tracing y las partes de Replay", () => {
    expect(clientSentryDefines(false)).toEqual({
      __SENTRY_TRACING__: false,
      __RRWEB_EXCLUDE_IFRAME__: true,
      __RRWEB_EXCLUDE_SHADOW_DOM__: true,
    });
  });

  it("servidor y edge: no se toca (las trazas del servidor no pesan al usuario)", () => {
    expect(clientSentryDefines(true)).toBeNull();
  });
});
