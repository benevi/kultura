/**
 * F-22 (D-02) — CSP en dos políticas.
 *
 * - `src/lib/csp.ts` decide qué rutas son cacheables (`isStaticCspRoute`) y
 *   construye la CSP fija, la de nonce y la solo de informe.
 * - `next.config.mjs` no puede importar TypeScript y repite las cadenas: aquí
 *   se exige que las dos copias digan exactamente lo mismo, también las rutas
 *   (con el mismo `path-to-regexp` que usa Next para `headers()`).
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
// El mismo path-to-regexp con el que Next compila las `source` de `headers()`
// (no trae tipos).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (source: string) => RegExp;
};
import {
  REPORTING_ENDPOINTS,
  buildCsp,
  buildReportOnlyCsp,
  buildStaticCsp,
  isStaticCspRoute,
} from "@/lib/csp";

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

interface ConfigModule {
  default: { headers: () => Promise<Rule[]> };
  STATIC_CSP_SOURCES: string[];
  staticCsp: (isDev: boolean) => string;
  reportOnlyCsp: (supabaseUrl: string | undefined) => string;
}

let mod: ConfigModule;
let rules: Rule[];

beforeAll(async () => {
  mod = (await import("../../../next.config.mjs")) as unknown as ConfigModule;
  rules = await mod.default.headers();
});

const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d === name || d.startsWith(`${name} `));

const STATIC_PATHS = [
  "/es",
  "/en",
  "/es/best",
  "/en/best/anime",
  "/es/best/movie/2026",
  "/es/best/movie/2026/opengraph-image",
  "/es/privacy",
  "/en/terms",
  "/es/legal",
  "/en/accessibility",
  "/es/offline",
];

const DYNAMIC_PATHS = [
  "/",
  "/fr",
  "/es/login",
  "/es/reset-password",
  "/es/welcome",
  "/es/report",
  "/es/u/benevi",
  "/es/u/benevi/l/1",
  "/es/media/movie/603",
  "/es/home",
  "/es/library",
  "/es/settings",
  "/es/bestias",
  "/es/privacy-extra",
  "/es/privacy/x",
  "/api/discover",
  "/api/csp-report",
];

describe("isStaticCspRoute — qué rutas salen del CDN (D-02)", () => {
  it.each(STATIC_PATHS)("%s es cacheable", (path) => {
    expect(isStaticCspRoute(path)).toBe(true);
  });

  it.each(DYNAMIC_PATHS)("%s conserva el nonce", (path) => {
    expect(isStaticCspRoute(path)).toBe(false);
  });

  it("la barra final no cambia la decisión", () => {
    expect(isStaticCspRoute("/es/best/")).toBe(true);
    expect(isStaticCspRoute("/es/login/")).toBe(false);
  });
});

describe("next.config.mjs — la misma lista de rutas", () => {
  const matchesConfig = (path: string) =>
    mod.STATIC_CSP_SOURCES.some((source) => pathToRegexp(source).test(path));

  it.each([...STATIC_PATHS, ...DYNAMIC_PATHS])("%s: config y middleware coinciden", (path) => {
    expect(matchesConfig(path)).toBe(isStaticCspRoute(path));
  });

  it("cada ruta de la lista lleva la CSP fija (y ninguna otra regla la pone)", () => {
    for (const source of mod.STATIC_CSP_SOURCES) {
      const rule = rules.find((r) => r.source === source);
      const csp = rule?.headers.find((h) => h.key === "Content-Security-Policy")?.value;
      // En vitest NODE_ENV no es production: la de desarrollo.
      expect(csp).toBe(buildStaticCsp({ isDev: true }));
    }
    const others = rules.filter((r) => !mod.STATIC_CSP_SOURCES.includes(r.source));
    for (const rule of others) {
      expect(rule.headers.some((h) => h.key === "Content-Security-Policy")).toBe(false);
    }
  });
});

describe("CSP fija de las rutas cacheables", () => {
  const csp = buildStaticCsp({ isDev: false });

  it("es idéntica en src/lib/csp.ts y en next.config.mjs (prod y dev)", () => {
    expect(mod.staticCsp(false)).toBe(csp);
    expect(mod.staticCsp(true)).toBe(buildStaticCsp({ isDev: true }));
  });

  it("script-src 'self' 'unsafe-inline' sin nonce ni unsafe-eval (excepción firmada en F-22)", () => {
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("nonce-");
  });

  it.each([
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
    "report-to csp",
  ])("conserva %s", (d) => {
    expect(csp.split("; ")).toContain(d);
  });

  it("el resto de directivas es el mismo que el de la política con nonce", () => {
    const withNonce = buildCsp({ nonce: "n", isDev: false }).split("; ");
    const fixed = csp.split("; ");
    const strip = (list: string[]) => list.filter((d) => !d.startsWith("script-src"));
    expect(strip(fixed)).toEqual(strip(withNonce));
  });

  it("en desarrollo permite el HMR (unsafe-eval y WebSocket local)", () => {
    const dev = buildStaticCsp({ isDev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws://localhost:*");
    expect(dev).not.toContain("report-uri");
  });
});

describe("política con nonce — informes (SEG-10)", () => {
  it("prod: manda informes a /api/csp-report; dev no", () => {
    const prod = buildCsp({ nonce: "n", isDev: false }).split("; ");
    expect(prod).toContain("report-uri /api/csp-report");
    expect(prod).toContain("report-to csp");
    expect(buildCsp({ nonce: "n", isDev: true })).not.toContain("report-");
  });
});

describe("política solo de informe con connect-src acotado (SEG-10)", () => {
  const url = "https://abcd.supabase.co";

  it("es idéntica en src/lib/csp.ts y en next.config.mjs", () => {
    expect(mod.reportOnlyCsp(url)).toBe(buildReportOnlyCsp(url));
    expect(mod.reportOnlyCsp(undefined)).toBe(buildReportOnlyCsp(undefined));
    expect(mod.reportOnlyCsp("no es una url")).toBe(buildReportOnlyCsp("no es una url"));
  });

  it("connect-src: solo el propio origen, Supabase (https y wss) y Sentry", () => {
    expect(directive(buildReportOnlyCsp(url), "connect-src")).toBe(
      "connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co https://*.ingest.sentry.io https://*.ingest.de.sentry.io"
    );
  });

  it("sin upgrade-insecure-requests (en una de informe el navegador la ignora y avisa)", () => {
    expect(buildReportOnlyCsp(url)).not.toContain("upgrade-insecure-requests");
    expect(buildReportOnlyCsp(url)).toContain("report-uri /api/csp-report");
  });

  it("Reporting-Endpoints en todas las rutas, con el grupo de report-to", () => {
    const all = rules.find((r) => r.source === "/(.*)")?.headers ?? [];
    expect(all.find((h) => h.key === "Reporting-Endpoints")?.value).toBe(REPORTING_ENDPOINTS);
    expect(REPORTING_ENDPOINTS).toBe('csp="/api/csp-report"');
  });
});
