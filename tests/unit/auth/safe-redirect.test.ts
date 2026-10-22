/**
 * Destinos de vuelta tras entrar (`next`): saneado, locale y bucles.
 */
import { describe, it, expect } from "vitest";
import {
  safeInternalPath,
  resolveAuthNext,
  localeFromPath,
  loginRedirectPath,
} from "@/lib/utils/safe-redirect";

describe("safeInternalPath — caracteres que el navegador descarta", () => {
  // Regresión: el navegador quita tabuladores y saltos de línea de una URL,
  // así que "/\t/evil.com" acaba siendo "//evil.com" (externo).
  it("rechaza tabuladores, saltos de línea y otros controles", () => {
    expect(safeInternalPath("/\t/evil.com")).toBe("/");
    expect(safeInternalPath("/\n/evil.com")).toBe("/");
    expect(safeInternalPath("/\r/evil.com")).toBe("/");
    expect(safeInternalPath("/\u0000x")).toBe("/");
  });

  it("rechaza espacios y la barra invertida en cualquier posición", () => {
    expect(safeInternalPath("/ /evil.com")).toBe("/");
    expect(safeInternalPath("/es\\@evil.com")).toBe("/");
  });

  it("sigue aceptando rutas internas con query", () => {
    expect(safeInternalPath("/es/u/benevi/l/1?tab=a")).toBe("/es/u/benevi/l/1?tab=a");
  });
});

describe("resolveAuthNext", () => {
  it("sin next → inicio en el idioma pedido", () => {
    expect(resolveAuthNext(null, "es")).toBe("/es/home");
    expect(resolveAuthNext("", "en")).toBe("/en/home");
  });

  it("conserva una ruta interna con locale", () => {
    expect(resolveAuthNext("/es/library", "es")).toBe("/es/library");
    expect(resolveAuthNext("/en/u/benevi/l/7?x=1", "es")).toBe("/en/u/benevi/l/7?x=1");
  });

  it("añade el locale si la ruta no lo trae", () => {
    expect(resolveAuthNext("/library", "en")).toBe("/en/library");
  });

  it("rechaza destinos externos", () => {
    expect(resolveAuthNext("https://evil.com", "es")).toBe("/es/home");
    expect(resolveAuthNext("//evil.com", "es")).toBe("/es/home");
    expect(resolveAuthNext("/\t/evil.com", "es")).toBe("/es/home");
  });

  it("no vuelve al login (bucle), a la API ni a la portada", () => {
    expect(resolveAuthNext("/es/login?mode=reset", "es")).toBe("/es/home");
    expect(resolveAuthNext("/login", "es")).toBe("/es/home");
    expect(resolveAuthNext("/api/auth/callback", "es")).toBe("/es/home");
    expect(resolveAuthNext("/es", "es")).toBe("/es/home");
    expect(resolveAuthNext("/", "es")).toBe("/es/home");
  });

  it("permite la pantalla de contraseña nueva (la usa la recuperación)", () => {
    expect(resolveAuthNext("/es/reset-password", "es")).toBe("/es/reset-password");
  });
});

describe("localeFromPath", () => {
  it("lee el locale del primer segmento", () => {
    expect(localeFromPath("/en/home")).toBe("en");
    expect(localeFromPath("/es")).toBe("es");
    expect(localeFromPath("/fr/home")).toBeNull();
    expect(localeFromPath(null)).toBeNull();
    expect(localeFromPath("/english")).toBeNull();
  });
});

describe("loginRedirectPath", () => {
  it("una sola redirección con next codificado", () => {
    expect(loginRedirectPath("es", "/es/library")).toBe("/es/login?next=%2Fes%2Flibrary");
  });

  it("sin ruta conocida → login sin next", () => {
    expect(loginRedirectPath("en", null)).toBe("/en/login");
  });

  it("no mete un next peligroso", () => {
    expect(loginRedirectPath("es", "//evil.com")).toBe("/es/login");
    expect(loginRedirectPath("es", "/es/login")).toBe("/es/login");
  });
});
