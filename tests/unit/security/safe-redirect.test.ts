/**
 * Tests unitarios — safeInternalPath (defensa contra open redirects).
 * Cubre el fix S1: el `next` del callback de auth debe rechazar destinos externos.
 */
import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/lib/utils/safe-redirect";

describe("safeInternalPath", () => {
  it("acepta rutas internas absolutas", () => {
    expect(safeInternalPath("/home")).toBe("/home");
    expect(safeInternalPath("/lists/123?tab=items")).toBe("/lists/123?tab=items");
    expect(safeInternalPath("/")).toBe("/");
  });

  it("rechaza null/vacío → fallback", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });

  it("rechaza URLs absolutas externas", () => {
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("http://evil.com/x")).toBe("/");
  });

  it("rechaza protocol-relative (//host) y backslash tricks", () => {
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("//evil.com/path")).toBe("/");
    expect(safeInternalPath("/\\evil.com")).toBe("/");
  });

  it("rechaza rutas relativas sin barra inicial", () => {
    expect(safeInternalPath("home")).toBe("/");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/");
  });

  it("respeta un fallback personalizado", () => {
    expect(safeInternalPath(null, "/login")).toBe("/login");
    expect(safeInternalPath("https://evil.com", "/login")).toBe("/login");
  });
});
