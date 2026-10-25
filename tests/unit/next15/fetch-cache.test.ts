// ============================================================
// KULTURA — Caché explícita en los `fetch` de servidor (F-20, Next 15)
//
// En Next 14 `fetch` se cacheaba por defecto; en 15 no. Lo que se protege:
//   - las llamadas a proveedores llevan su `revalidate` (una hora por defecto);
//   - las sondas "sin caché" piden `no-store` de forma explícita;
//   - las fuentes y portadas de las tarjetas de compartir se cachean.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

import { providerFetch, resetProviderCircuits } from "@/lib/api/http";
import { PROVIDER_REVALIDATE_SECONDS } from "@/lib/api/fetch-cache";
import { loadFont } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";

type NextInit = RequestInit & { next?: { revalidate?: number } };

const okJson = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

function lastInit(): NextInit {
  const calls = vi.mocked(fetch).mock.calls;
  return calls[calls.length - 1][1] as NextInit;
}

describe("fetch de servidor con caché explícita (Next 15)", () => {
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
    vi.stubGlobal("fetch", vi.fn(async () => okJson()));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proveedor por defecto: revalidate de una hora y sin `cache`", async () => {
    await providerFetch("tmdb", "https://api.example/a");
    const init = lastInit();
    expect(init.next).toEqual({ revalidate: PROVIDER_REVALIDATE_SECONDS });
    expect(init.cache).toBeUndefined();
  });

  it("proveedor con revalidate propio: lo respeta", async () => {
    await providerFetch("anilist", "https://api.example/b", { cache: { revalidate: 120 } });
    expect(lastInit().next).toEqual({ revalidate: 120 });
  });

  it("proveedor sin caché (sondas de salud): `no-store` explícito", async () => {
    await providerFetch("rawg", "https://api.example/c", { cache: false });
    const init = lastInit();
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
  });

  it("fuentes de las tarjetas de compartir: en la caché de datos", async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      String(input).includes("fonts.googleapis.com")
        ? new Response("src: url(https://fonts.example/f.ttf) format('truetype');")
        : new Response(new ArrayBuffer(4))
    );
    const font = await loadFont("Figtree", 700, "KULTURA");
    expect(font).not.toBeNull();
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [, init] of calls) {
      expect((init as NextInit | undefined)?.next?.revalidate).toBeGreaterThan(0);
    }
  });

  it("portadas de las tarjetas de compartir: en la caché de datos", async () => {
    vi.mocked(fetch).mockImplementation(
      async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } })
    );
    const uri = await posterDataUri("https://images.example/p.jpg");
    expect(uri).toMatch(/^data:image\/jpeg;base64,/);
    expect(lastInit().next?.revalidate).toBeGreaterThan(0);
  });
});
