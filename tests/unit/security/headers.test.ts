/**
 * Tests unitarios — Verifica que los security headers están definidos en next.config.mjs.
 * No hace una petición HTTP real; valida la configuración estática.
 */
import { describe, it, expect, beforeAll } from "vitest";

// Importamos la config tal como la exporta el módulo.
// next.config.mjs no puede importarse directamente en Vitest (es ESM con "mjs"),
// así que parseamos la configuración con una lectura de fichero + eval del CSP string.
// El test valida la PRESENCIA de los headers, no el runtime de Next.js.

const REQUIRED_CSP_DIRECTIVES = [
  "default-src",
  "frame-src",
  "script-src",
  "style-src",
  "img-src",
  "object-src",
];

const REQUIRED_HEADERS = [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
];

describe("next.config.mjs — security headers", () => {
  let configSource: string;

  beforeAll(async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    configSource = readFileSync(resolve(process.cwd(), "next.config.mjs"), "utf-8");
  });

  it("contiene función headers()", () => {
    expect(configSource).toContain("async headers()");
  });

  it.each(REQUIRED_HEADERS)("header '%s' está definido en la config", (header) => {
    expect(configSource).toContain(header);
  });

  it.each(REQUIRED_CSP_DIRECTIVES)(
    "directiva CSP '%s' está presente",
    (directive) => {
      expect(configSource).toContain(directive);
    }
  );

  it("frame-src incluye youtube (nocookie o normal)", () => {
    expect(configSource).toMatch(/frame-src.*youtube/);
  });

  it("object-src está restringido a 'none'", () => {
    expect(configSource).toContain("object-src 'none'");
  });

  it("X-Frame-Options limita el framing", () => {
    // SAMEORIGIN o DENY son válidos
    expect(configSource).toMatch(/X-Frame-Options[\s\S]*?(SAMEORIGIN|DENY)/);
  });

  it("CSP es environment-aware (dev vs prod)", () => {
    expect(configSource).toContain("isDev");
    expect(configSource).toContain("NODE_ENV");
  });

  it("dev CSP incluye unsafe-eval para webpack HMR", () => {
    expect(configSource).toContain("unsafe-eval");
  });

  it("dev CSP incluye ws:// para Fast Refresh WebSocket", () => {
    expect(configSource).toContain("ws://");
  });
});
