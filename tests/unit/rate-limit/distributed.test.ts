// @vitest-environment node
// ============================================================
// KULTURA — Límite de peticiones distribuido (F-13, D-21 / COD-6 / SEG-5)
//
// Aceptación: "con Upstash simulado, 31 peticiones/60 s → 429 entre
// instancias". Cada "instancia" es una copia nueva del módulo (memoria
// propia, como un arranque en frío en Vercel); lo único compartido es el
// Redis falso.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type RateLimitModule = typeof import("@/lib/rate-limit");

/** Redis REST falso de Upstash: `/multi-exec` (transacción) con INCR, PEXPIRE, GET. */
function fakeUpstash() {
  const store = new Map<string, number>();
  const commands: (string | number)[][] = [];
  const fetchSpy = vi.fn(async (input: string | URL, init?: RequestInit) => {
    expect(String(input)).toBe("https://eu1-kultura.upstash.io/multi-exec");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    const cmds = JSON.parse(String(init?.body)) as (string | number)[][];
    commands.push(...cmds);
    const results = cmds.map(([cmd, key]) => {
      const k = String(key);
      if (cmd === "INCR") {
        const v = (store.get(k) ?? 0) + 1;
        store.set(k, v);
        return { result: v };
      }
      if (cmd === "GET") return { result: store.has(k) ? String(store.get(k)) : null };
      return { result: 1 };
    });
    return new Response(JSON.stringify(results), { status: 200 });
  });
  return { store, commands, fetchSpy };
}

async function freshInstance(): Promise<RateLimitModule> {
  vi.resetModules();
  return import("@/lib/rate-limit");
}

const OPTS = { windowMs: 60_000, max: 30 };

beforeEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = "https://eu1-kultura.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "secret-token";
  vi.useFakeTimers();
  // Al principio de una ventana: el cubo anterior no pesa.
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 12, 0, 0)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

describe("checkRateLimitDistributed", () => {
  it("31 peticiones en 60 s repartidas entre tres instancias → la 31.ª es 429", async () => {
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchSpy);
    const instances = [await freshInstance(), await freshInstance(), await freshInstance()];

    for (let i = 0; i < 30; i++) {
      const r = await instances[i % 3].checkRateLimitDistributed("203.0.113.7:discover", OPTS);
      expect(r.allowed).toBe(true);
    }
    const blocked = await instances[1].checkRateLimitDistributed("203.0.113.7:discover", OPTS);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);

    // Otra IP no se ve afectada.
    const other = await instances[2].checkRateLimitDistributed("203.0.113.8:discover", OPTS);
    expect(other.allowed).toBe(true);
  });

  it("el límite de MEMORIA, en cambio, deja pasar 90 con tres instancias (lo que se arregla)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.UPSTASH_REDIS_REST_URL;
    const instances = [await freshInstance(), await freshInstance(), await freshInstance()];
    let allowed = 0;
    for (let i = 0; i < 90; i++) {
      if ((await instances[i % 3].checkRateLimitDistributed("ip:x", OPTS)).allowed) allowed++;
    }
    expect(allowed).toBe(90);
  });

  it("la IP no llega a Redis en claro: la clave es un hash", async () => {
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchSpy);
    const rl = await freshInstance();
    await rl.checkRateLimitDistributed("203.0.113.7:discover", OPTS);
    const keys = redis.commands.map((c) => String(c[1]));
    expect(keys.every((k) => k.startsWith("kultura:rl:"))).toBe(true);
    expect(keys.some((k) => k.includes("203.0.113.7"))).toBe(false);
    expect(redis.commands.map((c) => c[0])).toEqual(["INCR", "PEXPIRE", "GET"]);
  });

  it("ventana deslizante: a mitad de ventana el cubo anterior pesa la mitad", async () => {
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchSpy);
    const rl = await freshInstance();
    for (let i = 0; i < 30; i++) await rl.checkRateLimitDistributed("k", OPTS);
    // 30 s después del cambio de cubo: 30 × 0,5 = 15 "heredadas" → caben 15.
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 12, 1, 30)));
    let allowed = 0;
    for (let i = 0; i < 20; i++) {
      if ((await rl.checkRateLimitDistributed("k", OPTS)).allowed) allowed++;
    }
    expect(allowed).toBe(15);
  });

  it("Redis caído o lento → cae al límite de memoria sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 503 })));
    const rl = await freshInstance();
    const results = [];
    for (let i = 0; i < 31; i++) results.push(await rl.checkRateLimitDistributed("ip:y", OPTS));
    expect(results.slice(0, 30).every((r) => r.allowed)).toBe(true);
    expect(results[30].allowed).toBe(false);
  });

  it("tras un fallo de Redis no se vuelve a esperar por él durante 30 s", async () => {
    const spy = vi.fn(async () => new Response("boom", { status: 503 }));
    vi.stubGlobal("fetch", spy);
    const rl = await freshInstance();
    await rl.checkRateLimitDistributed("ip:w", OPTS);
    await rl.checkRateLimitDistributed("ip:w", OPTS);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 12, 0, 31)));
    await rl.checkRateLimitDistributed("ip:w", OPTS);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("va por el fetch ORIGINAL, no por el parcheado de Next (no toca la caché ni el render)", async () => {
    const redis = fakeUpstash();
    const patched = Object.assign(vi.fn(), { _nextOriginalFetch: redis.fetchSpy });
    vi.stubGlobal("fetch", patched);
    const rl = await freshInstance();
    expect((await rl.checkRateLimitDistributed("ip:o", OPTS)).allowed).toBe(true);
    expect(redis.fetchSpy).toHaveBeenCalledTimes(1);
    expect(patched).not.toHaveBeenCalled();
  });

  it("la señal DYNAMIC_SERVER_USAGE de Next no apaga el límite distribuido", async () => {
    const redis = fakeUpstash();
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        if (first) {
          first = false;
          throw Object.assign(new Error("Dynamic server usage: no-store fetch"), { digest: "DYNAMIC_SERVER_USAGE" });
        }
        return redis.fetchSpy(input, init);
      })
    );
    const rl = await freshInstance();
    await rl.checkRateLimitDistributed("ip:d", OPTS); // cae a memoria esta vez
    await rl.checkRateLimitDistributed("ip:d", OPTS); // y la siguiente vuelve a Redis
    expect(redis.fetchSpy).toHaveBeenCalledTimes(1);
    expect(rl.isNextDynamicUsage({ message: "x DYNAMIC_SERVER_USAGE" })).toBe(true);
    expect(rl.isNextDynamicUsage(new Error("Redis REST 503"))).toBe(false);
  });

  it("acepta también las variables de Vercel KV", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.KV_REST_API_URL = "https://eu1-kultura.upstash.io/";
    process.env.KV_REST_API_TOKEN = "secret-token";
    const redis = fakeUpstash();
    vi.stubGlobal("fetch", redis.fetchSpy);
    const rl = await freshInstance();
    expect(rl.redisRestConfig()).toEqual({ url: "https://eu1-kultura.upstash.io", token: "secret-token" });
    await rl.checkRateLimitDistributed("ip:z", OPTS);
    expect(redis.fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("una URL que no es https no se usa (modo memoria)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://redis.local";
    const rl = await freshInstance();
    expect(rl.redisRestConfig()).toBeNull();
  });
});

describe("checkRateLimit (memoria) — limpieza", () => {
  it("el Map se barre: miles de IPs de un día no se quedan para siempre", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const rl = await freshInstance();
    for (let i = 0; i < 5_000; i++) rl.checkRateLimit(`ip-${i}:search`, { windowMs: 60_000, max: 60 });
    expect(rl._storeSizeForTests()).toBe(5_000);
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 14, 0, 0)));
    rl.checkRateLimit("nueva:search", { windowMs: 60_000, max: 60 });
    expect(rl._storeSizeForTests()).toBe(1);
  });
});
