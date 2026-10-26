// ============================================================
// KULTURA — Circuito: una prueba half-open CANCELADA no cierra el circuito
//
// Revisión de F-13 (#36): si quien llama cancela la prueba (`signal`), el
// proveedor no ha dicho nada de su salud. Antes la cancelación se trataba
// como "respuesta normal" y cerraba el circuito, así que la siguiente
// petición volvía a ir a un proveedor que seguía caído sin pasar por la
// prueba. Ahora la cancelación solo libera la prueba: el circuito sigue
// half-open y la siguiente petición es la nueva prueba.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

import {
  providerFetch,
  providerCircuitState,
  resetProviderCircuits,
  ProviderError,
  CIRCUIT_OPEN_MS,
} from "@/lib/api/http";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function openThenHalfOpen(url: string) {
  vi.mocked(fetch).mockImplementation(async () => json({}, 503));
  for (let i = 0; i < 5; i++) {
    await providerFetch("rawg", `${url}/${i}`, { cache: false }).catch(() => {});
  }
  expect(providerCircuitState("rawg")).toBe("open");
  vi.setSystemTime(Date.now() + CIRCUIT_OPEN_MS + 1);
  expect(providerCircuitState("rawg")).toBe("half-open");
}

describe("circuito half-open y cancelación", () => {
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cancelar la prueba la libera sin cerrar el circuito", async () => {
    await openThenHalfOpen("https://api.rawg.io/api/a");

    // La prueba se queda colgada y quien llama la cancela.
    vi.mocked(fetch).mockImplementation(
      (_u, init) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        )
    );
    const controller = new AbortController();
    const probe = providerFetch("rawg", "https://api.rawg.io/api/probe", {
      cache: false,
      signal: controller.signal,
    }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    const err = await probe;
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe("aborted");

    // Sigue half-open: no se ha sabido nada del proveedor.
    expect(providerCircuitState("rawg")).toBe("half-open");

    // La siguiente petición es la nueva prueba; si falla, se reabre.
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockImplementation(async () => json({}, 503));
    await providerFetch("rawg", "https://api.rawg.io/api/probe2", { cache: false }).catch(() => {});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(providerCircuitState("rawg")).toBe("open");
  });

  it("tras cancelar la prueba, otra petición puede probar y cerrar si responde", async () => {
    await openThenHalfOpen("https://api.rawg.io/api/b");
    vi.mocked(fetch).mockImplementation(
      (_u, init) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        )
    );
    const controller = new AbortController();
    const probe = providerFetch("rawg", "https://api.rawg.io/api/probe", {
      cache: false,
      signal: controller.signal,
    }).catch(() => {});
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await probe;

    vi.mocked(fetch).mockImplementation(async () => json({ results: [] }));
    await expect(
      providerFetch("rawg", "https://api.rawg.io/api/probe3", { cache: false })
    ).resolves.toEqual({ results: [] });
    expect(providerCircuitState("rawg")).toBe("closed");
  });
});
