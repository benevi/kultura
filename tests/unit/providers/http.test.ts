// ============================================================
// KULTURA — providerFetch (COD-1, COD-2, ROJO-11)
//
// Lo que se protege:
//   - ninguna petición a un proveedor pasa de 6 s;
//   - solo se reintenta un 5xx;
//   - una respuesta que rompe el contrato no se cachea (modo `enforce`) y en
//     modo `log` se sirve igual pero se avisa;
//   - el circuit breaker deja de llamar a un proveedor caído y avisa a Sentry
//     con la etiqueta `provider`;
//   - el User-Agent no anuncia un dominio ajeno.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { cacheStore, fakeUnstableCache } from "./cache-mock";

vi.mock("next/cache", () => ({ unstable_cache: fakeUnstableCache }));

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

import {
  providerFetch,
  providerUserAgent,
  providerCircuitState,
  resetProviderCircuits,
  ProviderContractError,
  ProviderError,
  ProviderUnavailableError,
  PROVIDER_TIMEOUT_MS,
  PROVIDER_MAX_TIMEOUT_MS,
  PROVIDER_TOTAL_BUDGET_MS,
  CIRCUIT_OPEN_MS,
} from "@/lib/api/http";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const schema = z.looseObject({ results: z.array(z.looseObject({ id: z.number() })) });

/** fetch que nunca responde salvo que se aborte (como uno colgado). */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError"))
        );
      })
  );
}

describe("providerFetch", () => {
  beforeEach(() => {
    resetProviderCircuits();
    cacheStore.clear();
    captureMessage.mockClear();
    delete process.env.PROVIDER_CONTRACT_MODE;
    delete process.env.PROVIDER_CONTACT;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  // ── Plazo ──────────────────────────────────────────────────────────────────

  it("ninguna petición pasa de 6 s: un proveedor colgado falla con kind=timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const p = providerFetch("rawg", "https://api.rawg.io/api/games").catch((e) => e);

    await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS - 1);
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const err = await p;
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe("timeout");
    // La señal se aborta: la conexión no queda abierta.
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
  });

  it("aunque el proveedor ignore la señal de aborto, a los 6 s se corta", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const p = providerFetch("tmdb", "https://api.themoviedb.org/3/x").catch((e) => e);
    await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS);
    expect(((await p) as ProviderError).kind).toBe("timeout");
  });

  it("un cliente puede pedir hasta 8 s (Open Library), pero no más", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const p = providerFetch("openlibrary", "https://openlibrary.org/search.json", {
      timeoutMs: 20_000,
    }).catch((e) => e);
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS);
    expect(settled).toBe(false); // a los 6 s aún espera…
    await vi.advanceTimersByTimeAsync(PROVIDER_MAX_TIMEOUT_MS - PROVIDER_TIMEOUT_MS);
    expect(((await p) as ProviderError).kind).toBe("timeout"); // …a los 8 s corta
  });

  it("con reintento, la llamada entera no pasa de 8 s", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          // 1.er intento: 503 a los 5 s. 2.º: colgado.
          if (fetchMock.mock.calls.length === 1) {
            setTimeout(() => resolve(json({}, 503)), 5000);
          }
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const started = Date.now();
    const p = providerFetch("anilist", "https://graphql.anilist.co", {
      method: "POST",
      retries: 1,
    }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(PROVIDER_TOTAL_BUDGET_MS);
    const err = (await p) as ProviderError;
    expect(err.kind).toBe("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThanOrEqual(PROVIDER_TOTAL_BUDGET_MS);
  });

  it("si no queda presupuesto para un intento útil, no reintenta", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => setTimeout(() => resolve(json({}, 503)), 7000))
    );
    vi.stubGlobal("fetch", fetchMock);
    const p = providerFetch("jikan", "https://api.jikan.moe/v4/x", {
      retries: 1,
      timeoutMs: 8000,
    }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(PROVIDER_TOTAL_BUDGET_MS);
    expect(((await p) as ProviderError).status).toBe(503);
    // 8 s − 7 s − 0,4 s de espera < 1 s: el segundo intento no sale.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Reintentos ─────────────────────────────────────────────────────────────

  it("reintenta un 5xx si se pide, y no un 4xx", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ results: [] }));
    const p = providerFetch("jikan", "https://api.jikan.moe/v4/x", { retries: 1 });
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ results: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => json({}, 429));
    const q = providerFetch("jikan", "https://api.jikan.moe/v4/y", { retries: 1 }).catch(
      (e) => e
    );
    await vi.runAllTimersAsync();
    expect(((await q) as ProviderError).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("httpError conserva la clase de error de cada cliente", async () => {
    class MyError extends Error {
      constructor(readonly status: number) {
        super(`mine ${status}`);
      }
    }
    vi.mocked(fetch).mockImplementation(async () => json({}, 404));
    await expect(
      providerFetch("googlebooks", "https://x.test/v", { httpError: (s) => new MyError(s) })
    ).rejects.toBeInstanceOf(MyError);
  });

  // ── Contrato y caché ───────────────────────────────────────────────────────

  it("respuesta válida: se cachea (la segunda llamada no sale a la red)", async () => {
    vi.mocked(fetch).mockImplementation(async () => json({ results: [{ id: 1 }] }));
    await providerFetch("rawg", "https://api.rawg.io/api/games", { schema });
    await providerFetch("rawg", "https://api.rawg.io/api/games", { schema });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("modo enforce: contrato roto → ProviderContractError y NO se cachea", async () => {
    process.env.PROVIDER_CONTRACT_MODE = "enforce";
    vi.mocked(fetch).mockImplementation(async () => json({ results: [{ name: "sin id" }] }));
    await expect(
      providerFetch("rawg", "https://api.rawg.io/api/games", { schema })
    ).rejects.toBeInstanceOf(ProviderContractError);
    await expect(
      providerFetch("rawg", "https://api.rawg.io/api/games", { schema })
    ).rejects.toBeInstanceOf(ProviderContractError);
    // Las dos veces fue a la red: el rechazo no quedó guardado.
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cacheStore.size).toBe(0);
  });

  it("modo log (por defecto): contrato roto → se sirve igual y se avisa UNA vez", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://dsn.test/1";
    const body = { results: [{ name: "sin id" }] };
    vi.mocked(fetch).mockImplementation(async () => json(body));
    const out = await providerFetch("rawg", "https://api.rawg.io/api/games?page=1", {
      schema,
      label: "/games",
    });
    expect(out).toEqual(body);
    // Otra URL del mismo endpoint: no repite el aviso (deduplicado 10 min).
    await providerFetch("rawg", "https://api.rawg.io/api/games?page=2", {
      schema,
      label: "/games",
    });
    await vi.waitFor(() => expect(captureMessage).toHaveBeenCalledTimes(1));
    const [, ctx] = captureMessage.mock.calls[0];
    expect(ctx.tags.provider).toBe("rawg");
    expect(ctx.tags.provider_incident).toBe("contract");
  });

  it("un valor desconocido en PROVIDER_CONTRACT_MODE se trata como log", async () => {
    process.env.PROVIDER_CONTRACT_MODE = "estricto";
    vi.mocked(fetch).mockImplementation(async () => json({ results: "no es lista" }));
    await expect(
      providerFetch("rawg", "https://api.rawg.io/api/games", { schema })
    ).resolves.toEqual({ results: "no es lista" });
  });

  it("devuelve el JSON tal cual (el contrato vigila, no transforma)", async () => {
    const body = { results: [{ id: 1, extra: { a: 1 } }], otro: true };
    vi.mocked(fetch).mockImplementation(async () => json(body));
    expect(await providerFetch("rawg", "https://api.rawg.io/api/games", { schema })).toEqual(
      body
    );
  });

  it("checkBody que lanza (error dentro de un 200): no se cachea", async () => {
    vi.mocked(fetch).mockImplementation(async () => json({ status_code: 107 }));
    const checkBody = () => {
      throw new ProviderError("comicvine", "upstream", "límite", { status: 429 });
    };
    await expect(
      providerFetch("comicvine", "https://cv.test/issues", { checkBody })
    ).rejects.toThrow("límite");
    await expect(
      providerFetch("comicvine", "https://cv.test/issues", { checkBody })
    ).rejects.toThrow("límite");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("un cuerpo que no es JSON es un fallo de contrato, no un crash", async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response("<html>", { status: 200 }));
    const err = await providerFetch("tmdb", "https://api.themoviedb.org/3/x").catch((e) => e);
    expect((err as ProviderError).kind).toBe("contract");
  });

  // ── Circuit breaker ────────────────────────────────────────────────────────

  it("AniList con 403: tras 5 fallos la 6.ª petición no lo llama y Sentry recibe provider=anilist", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://dsn.test/1";
    vi.mocked(fetch).mockImplementation(async () => json({}, 403));
    for (let i = 0; i < 5; i++) {
      await expect(
        providerFetch("anilist", "https://graphql.anilist.co", {
          method: "POST",
          body: String(i),
        })
      ).rejects.toMatchObject({ status: 403 });
    }
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(providerCircuitState("anilist")).toBe("open");

    await expect(
      providerFetch("anilist", "https://graphql.anilist.co", { method: "POST", body: "6" })
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(fetch).toHaveBeenCalledTimes(5);

    await vi.waitFor(() =>
      expect(captureMessage).toHaveBeenCalledWith(
        expect.stringContaining("anilist"),
        expect.objectContaining({
          tags: expect.objectContaining({ provider: "anilist", provider_incident: "circuit_open" }),
        })
      )
    );
    // Otro proveedor no se ve afectado.
    vi.mocked(fetch).mockImplementation(async () => json({ results: [] }));
    await expect(providerFetch("tmdb", "https://api.themoviedb.org/3/x")).resolves.toBeTruthy();
  });

  it("los 404 no abren el circuito (un título inexistente no es una caída)", async () => {
    vi.mocked(fetch).mockImplementation(async () => json({}, 404));
    for (let i = 0; i < 8; i++) {
      await providerFetch("tmdb", `https://api.themoviedb.org/3/movie/${i}`).catch(() => {});
    }
    expect(providerCircuitState("tmdb")).toBe("closed");
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it("los fallos fuera de la ventana de 5 min no suman", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => json({}, 500));
    for (let i = 0; i < 4; i++) {
      await providerFetch("rawg", `https://api.rawg.io/api/${i}`).catch(() => {});
    }
    vi.setSystemTime(Date.now() + 5 * 60_000 + 1);
    await providerFetch("rawg", "https://api.rawg.io/api/x").catch(() => {});
    expect(providerCircuitState("rawg")).toBe("closed");
  });

  it("pasados 10 min deja pasar UNA prueba; si responde, el circuito se cierra", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => json({}, 503));
    for (let i = 0; i < 5; i++) {
      await providerFetch("comicvine", `https://cv.test/${i}`).catch(() => {});
    }
    expect(providerCircuitState("comicvine")).toBe("open");

    vi.setSystemTime(Date.now() + CIRCUIT_OPEN_MS + 1);
    expect(providerCircuitState("comicvine")).toBe("half-open");
    vi.mocked(fetch).mockImplementation(async () => json({ ok: 1 }));
    await expect(providerFetch("comicvine", "https://cv.test/probe")).resolves.toEqual({ ok: 1 });
    expect(providerCircuitState("comicvine")).toBe("closed");
  });

  it("en half-open solo UNA petición concurrente llega al proveedor", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => json({}, 503));
    for (let i = 0; i < 5; i++) {
      await providerFetch("rawg", `https://api.rawg.io/api/${i}`).catch(() => {});
    }
    vi.setSystemTime(Date.now() + CIRCUIT_OPEN_MS + 1);
    vi.mocked(fetch).mockClear();

    // La prueba tarda: mientras está en vuelo llegan otras cuatro.
    let release!: (r: Response) => void;
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((resolve) => (release = resolve))
    );
    const calls = [0, 1, 2, 3, 4].map((i) =>
      providerFetch("rawg", `https://api.rawg.io/api/probe${i}`).then(
        () => "ok",
        (e) => e
      )
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    release(json({ results: [] }));
    const results = await Promise.all(calls);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.filter((r) => r instanceof ProviderUnavailableError)).toHaveLength(4);
    expect(providerCircuitState("rawg")).toBe("closed");
  });

  it("si la prueba vuelve a fallar, se reabre 10 min más", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => json({}, 503));
    for (let i = 0; i < 5; i++) {
      await providerFetch("steam", `https://st.test/${i}`).catch(() => {});
    }
    vi.setSystemTime(Date.now() + CIRCUIT_OPEN_MS + 1);
    await providerFetch("steam", "https://st.test/probe").catch(() => {});
    expect(providerCircuitState("steam")).toBe("open");
  });

  it("una respuesta cacheada se sirve aunque el circuito esté abierto", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ results: [] }));
    await providerFetch("mangadex", "https://api.mangadex.org/manga");
    vi.mocked(fetch).mockImplementation(async () => json({}, 500));
    for (let i = 0; i < 5; i++) {
      await providerFetch("mangadex", `https://api.mangadex.org/m${i}`).catch(() => {});
    }
    expect(providerCircuitState("mangadex")).toBe("open");
    await expect(providerFetch("mangadex", "https://api.mangadex.org/manga")).resolves.toEqual({
      results: [],
    });
  });

  // ── Identificación ─────────────────────────────────────────────────────────

  it("User-Agent: URL real, contacto opcional y nunca kultura.app", async () => {
    expect(providerUserAgent()).toBe("KULTURA/1.0 (+https://kulturaapp.vercel.app)");
    process.env.PROVIDER_CONTACT = "hola@ejemplo.test\r\nX: y";
    expect(providerUserAgent()).toBe(
      "KULTURA/1.0 (+https://kulturaapp.vercel.app; hola@ejemplo.testX: y)"
    );
    vi.mocked(fetch).mockImplementation(async () => json({}));
    await providerFetch("openlibrary", "https://openlibrary.org/x", { cache: false });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const ua = (init.headers as Record<string, string>)["User-Agent"];
    expect(ua).toContain("kulturaapp.vercel.app");
    expect(ua).not.toMatch(/\/\/kultura\.app/);
  });

  it("cache:false no pasa por la caché", async () => {
    vi.mocked(fetch).mockImplementation(async () => json({ a: 1 }));
    await providerFetch("tmdb", "https://api.themoviedb.org/3/configuration", { cache: false });
    await providerFetch("tmdb", "https://api.themoviedb.org/3/configuration", { cache: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(cacheStore.size).toBe(0);
  });
});
