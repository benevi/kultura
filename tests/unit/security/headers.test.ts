/**
 * Tests unitarios — Security headers.
 * - next.config.mjs: headers estáticos (no dependen del request).
 * - src/lib/csp.ts (C7): CSP dinámica con nonce por request, vía buildCsp().
 * No hace una petición HTTP real; valida la configuración/función directamente.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildCsp } from "@/lib/csp";

const REQUIRED_CSP_DIRECTIVES = [
  "default-src",
  "frame-src",
  "script-src",
  "style-src",
  "img-src",
  "object-src",
];

const REQUIRED_STATIC_HEADERS = [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
];

describe("next.config.mjs — security headers estáticos", () => {
  let configSource: string;

  beforeAll(async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    configSource = readFileSync(resolve(process.cwd(), "next.config.mjs"), "utf-8");
  });

  it("contiene función headers()", () => {
    expect(configSource).toContain("async headers()");
  });

  it.each(REQUIRED_STATIC_HEADERS)("header '%s' está definido en la config", (header) => {
    expect(configSource).toContain(header);
  });

  it("X-Frame-Options limita el framing", () => {
    // SAMEORIGIN o DENY son válidos
    expect(configSource).toMatch(/X-Frame-Options[\s\S]*?(SAMEORIGIN|DENY)/);
  });

  it("ya NO define Content-Security-Policy aquí (C7: se mueve a middleware.ts por el nonce)", () => {
    expect(configSource).not.toContain("Content-Security-Policy");
  });
});

describe("src/lib/csp.ts — buildCsp() (C7: nonce por request)", () => {
  const NONCE = "test-nonce-abc123";

  it.each(REQUIRED_CSP_DIRECTIVES)("directiva CSP '%s' está presente en prod", (directive) => {
    const csp = buildCsp({ nonce: NONCE, isDev: false });
    expect(csp).toContain(directive);
  });

  it("frame-src incluye youtube (nocookie o normal)", () => {
    const csp = buildCsp({ nonce: NONCE, isDev: false });
    expect(csp).toMatch(/frame-src.*youtube/);
  });

  it("object-src está restringido a 'none'", () => {
    const csp = buildCsp({ nonce: NONCE, isDev: false });
    expect(csp).toContain("object-src 'none'");
  });

  it("prod: script-src usa el nonce y NO contiene 'unsafe-inline'", () => {
    const csp = buildCsp({ nonce: NONCE, isDev: false });
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("prod: script-src NO contiene 'unsafe-eval'", () => {
    const csp = buildCsp({ nonce: NONCE, isDev: false });
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("dev: script-src incluye 'unsafe-eval' para webpack HMR", () => {
    const csp = buildCsp({ nonce: NONCE, isDev: true });
    expect(csp).toContain("unsafe-eval");
  });

  it("dev: connect-src incluye ws:// para Fast Refresh WebSocket", () => {
    const csp = buildCsp({ nonce: NONCE, isDev: true });
    expect(csp).toContain("ws://");
  });

  it("dos nonces distintos producen script-src distinto (no cacheado/estático)", () => {
    const cspA = buildCsp({ nonce: "aaa", isDev: false });
    const cspB = buildCsp({ nonce: "bbb", isDev: false });
    expect(cspA).not.toEqual(cspB);
  });

  it("style-src conserva 'unsafe-inline' (Radix posiciona vía style=\"\" inline, fuera de alcance de C7)", () => {
    const csp = buildCsp({ nonce: NONCE, isDev: false });
    const styleSrc = csp.split(";").find((d) => d.trim().startsWith("style-src"));
    expect(styleSrc).toContain("unsafe-inline");
  });
});
