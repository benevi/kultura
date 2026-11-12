import { describe, it, expect } from "vitest";
import { isOutage } from "../../contract/outage-reporter";
import { ProviderError } from "@/lib/api/http";

describe("isOutage (contrato de proveedores)", () => {
  it("tiempo agotado, red y circuito abierto son caídas", () => {
    expect(isOutage(new ProviderError("rawg", "timeout", "x"))).toBe(true);
    expect(isOutage(new ProviderError("jikan", "network", "x"))).toBe(true);
    expect(isOutage(new ProviderError("rawg", "circuit_open", "x"))).toBe(true);
  });

  it("5xx y 429 son caídas; 4xx no", () => {
    expect(isOutage(new ProviderError("rawg", "http", "x", { status: 503 }))).toBe(true);
    expect(isOutage(new ProviderError("rawg", "http", "x", { status: 429 }))).toBe(true);
    expect(isOutage(new ProviderError("rawg", "http", "x", { status: 404 }))).toBe(false);
  });

  it("contrato roto y aserciones no son caídas", () => {
    expect(isOutage(new ProviderError("tmdb", "contract", "x"))).toBe(false);
    expect(isOutage(new Error("expected 1 to be 2"))).toBe(false);
    expect(isOutage(undefined)).toBe(false);
  });

  it("mira la cadena `cause` (expect(...).resolves sobre una caída)", () => {
    const err = { name: "AssertionError", message: "promise rejected", cause: { name: "ProviderError", kind: "timeout" } };
    expect(isOutage(err)).toBe(true);
  });
});
