// @vitest-environment node
// ============================================================
// KULTURA — Cupos de los proveedores (F-13, ROJO-9, D-17)
//
// Aceptación: "simular el 80 % del cupo de RAWG dispara un evento de Sentry".
// Además: solo cuentan las peticiones REALES (no las servidas por la caché),
// ComicVine cuenta por recurso y por hora, el aviso sale UNA vez por umbral,
// con Redis manda la cuenta compartida y un Redis caído no rompe nada.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStore, fakeUnstableCache } from "../providers/cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

import { _resetStoreForTests } from "@/lib/rate-limit";
import {
  providerFetch,
  providerQuotaUsage,
  isProviderQuotaHot,
  quotaPeriodKey,
  quotaResource,
  recordProviderCall,
  flushProviderQuota,
  resetProviderQuota,
  resetProviderCircuits,
  _setProviderQuotaUsageForTests,
  PROVIDER_QUOTAS,
} from "@/lib/api/http";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Espera a que se resuelvan los `import()` dinámicos de Sentry. */
const tick = () => new Promise((r) => setTimeout(r, 0));

function quotaEvents() {
  return captureMessage.mock.calls.filter(
    (c) => (c[1] as { tags?: Record<string, string> })?.tags?.provider_incident === "quota"
  );
}

beforeEach(() => {
  _resetStoreForTests();
  resetProviderCircuits();
  resetProviderQuota();
  cacheStore.clear();
  captureMessage.mockClear();
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.example/1";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

describe("cupos conocidos", () => {
  it("RAWG 20.000 al mes; ComicVine 200 por recurso y hora", () => {
    expect(PROVIDER_QUOTAS.rawg).toEqual({ limit: 20_000, period: "month" });
    expect(PROVIDER_QUOTAS.comicvine).toEqual({ limit: 200, period: "hour", perResource: true });
  });

  it("periodo en UTC y recurso de ComicVine a partir de la URL", () => {
    const t = Date.UTC(2026, 9, 22, 14, 59);
    expect(quotaPeriodKey("month", t)).toBe("2026-10");
    expect(quotaPeriodKey("hour", t)).toBe("2026-10-22T14");
    expect(quotaResource("comicvine", "https://comicvine.gamespot.com/api/search/?query=x")).toBe("search");
    expect(quotaResource("comicvine", "https://comicvine.gamespot.com/api/issue/4000-1/")).toBe("issue");
    expect(quotaResource("rawg", "https://api.rawg.io/api/games")).toBe("all");
  });
});

describe("aviso a Sentry al 80 %", () => {
  it("RAWG: la petición que cruza el 80 % (16.000 de 20.000) dispara UN evento con la etiqueta provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: [] })));
    _setProviderQuotaUsageForTests("rawg", 15_999);

    await providerFetch("rawg", "https://api.rawg.io/api/games?search=a", { cache: false });
    await tick();
    const events = quotaEvents();
    expect(events).toHaveLength(1);
    expect(events[0][0]).toMatch(/rawg: 16000 de 20000 .*80 %/);
    expect(events[0][1]).toMatchObject({ level: "warning", tags: { provider: "rawg", provider_incident: "quota" } });

    // Las siguientes no repiten el aviso del mismo umbral.
    await providerFetch("rawg", "https://api.rawg.io/api/games?search=b", { cache: false });
    await tick();
    expect(quotaEvents()).toHaveLength(1);
    expect(isProviderQuotaHot("rawg")).toBe(true);
  });

  it("al agotar el cupo (100 %) avisa otra vez", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: [] })));
    _setProviderQuotaUsageForTests("rawg", 19_999);
    await providerFetch("rawg", "https://api.rawg.io/api/games?search=c", { cache: false });
    await tick();
    expect(quotaEvents().map((c) => c[0])).toEqual([expect.stringMatching(/100 % del cupo/)]);
  });

  it("por debajo del 80 % no hay aviso", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: [] })));
    _setProviderQuotaUsageForTests("rawg", 10_000);
    await providerFetch("rawg", "https://api.rawg.io/api/games?search=d", { cache: false });
    await tick();
    expect(quotaEvents()).toHaveLength(0);
    expect(providerQuotaUsage("rawg")).toBeCloseTo(10_001 / 20_000);
  });

  it("ComicVine cuenta por recurso: 160 de /search/ avisa; /issues/ va aparte", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ status_code: 1, results: [] })));
    _setProviderQuotaUsageForTests("comicvine", 159, "search");
    await providerFetch("comicvine", "https://comicvine.gamespot.com/api/issues/?x=1", { cache: false });
    await tick();
    expect(quotaEvents()).toHaveLength(0);
    await providerFetch("comicvine", "https://comicvine.gamespot.com/api/search/?query=x", { cache: false });
    await tick();
    expect(quotaEvents()).toHaveLength(1);
    expect(quotaEvents()[0][0]).toMatch(/recurso search/);
    expect(isProviderQuotaHot("comicvine", "search")).toBe(true);
    expect(isProviderQuotaHot("comicvine", "issues")).toBe(false);
  });

  it("la hora siguiente empieza de cero", () => {
    const t = Date.UTC(2026, 9, 22, 14, 30);
    _setProviderQuotaUsageForTests("comicvine", 190, "search", t);
    expect(isProviderQuotaHot("comicvine", "search", t)).toBe(true);
    expect(isProviderQuotaHot("comicvine", "search", t + 60 * 60_000)).toBe(false);
  });
});

describe("qué cuenta", () => {
  it("lo que sirve la caché no gasta cupo; un fallo del proveedor sí", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ results: [] })));
    await providerFetch("rawg", "https://api.rawg.io/api/games?search=e");
    await providerFetch("rawg", "https://api.rawg.io/api/games?search=e"); // de la caché
    expect(providerQuotaUsage("rawg") * 20_000).toBeCloseTo(1);

    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await providerFetch("rawg", "https://api.rawg.io/api/games?search=f").catch(() => {});
    expect(providerQuotaUsage("rawg") * 20_000).toBeCloseTo(2);
  });

  it("proveedores sin cupo publicado no cuentan", () => {
    recordProviderCall("tmdb", "https://api.themoviedb.org/3/search/movie");
    expect(providerQuotaUsage("tmdb")).toBe(0);
  });
});

describe("con Upstash (cuenta compartida entre instancias)", () => {
  function fakeRedis(start: number) {
    const store = new Map<string, number>();
    const spy = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith("https://redis.example")) return json({ results: [] });
      const cmds = JSON.parse(String(init?.body)) as (string | number)[][];
      return json(
        cmds.map(([cmd, key]) => {
          if (cmd === "INCR") {
            const v = (store.get(String(key)) ?? start) + 1;
            store.set(String(key), v);
            return { result: v };
          }
          return { result: 1 };
        })
      );
    });
    return { spy, store };
  }

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  });

  it("INCR en Redis con caducidad; el aviso sale en la instancia que ve el cruce", async () => {
    const { spy, store } = fakeRedis(15_999);
    vi.stubGlobal("fetch", spy);
    await providerFetch("rawg", "https://api.rawg.io/api/games?search=g", { cache: false });
    await flushProviderQuota();
    await tick();
    const call = spy.mock.calls.find((c) => String(c[0]) === "https://redis.example/pipeline");
    const cmds = JSON.parse(String((call?.[1] as RequestInit).body));
    expect(cmds[0][0]).toBe("INCR");
    expect(cmds[0][1]).toMatch(/^kultura:quota:rawg:all:\d{4}-\d{2}$/);
    expect(cmds[1][0]).toBe("EXPIRE");
    expect(Array.from(store.values())).toEqual([16_000]);
    expect(quotaEvents()).toHaveLength(1);
    expect(isProviderQuotaHot("rawg")).toBe(true);
  });

  it("Redis caído: la petición al proveedor no se resiente y se cuenta en memoria", async () => {
    const spy = vi.fn(async (input: string | URL) =>
      String(input).startsWith("https://redis.example") ? json({}, 500) : json({ results: [] })
    );
    vi.stubGlobal("fetch", spy);
    const res = await providerFetch<{ results: unknown[] }>("rawg", "https://api.rawg.io/api/games?search=h", {
      cache: false,
    });
    expect(res.results).toEqual([]);
    await flushProviderQuota();
    expect(providerQuotaUsage("rawg") * 20_000).toBeCloseTo(1);
  });
});
