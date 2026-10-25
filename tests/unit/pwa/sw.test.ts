/**
 * MOV-2 (VERIF-B, D-02) — service worker `public/sw.js`.
 *
 * Se ejecuta el archivo REAL en un contexto `vm` con un `self` falso, una
 * Cache Storage en memoria y un `fetch` simulado: así se prueban tanto las
 * funciones de enrutado como los eventos `install`, `activate` y `fetch`.
 */
// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");
const ORIGIN = "https://kulturaapp.vercel.app";

class MemoryCache {
  entries = new Map<string, Response>();
  private key(req: RequestInfo | URL) {
    const raw = typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
    return new URL(raw, ORIGIN).href;
  }
  async match(req: RequestInfo | URL) {
    const hit = this.entries.get(this.key(req));
    return hit ? hit.clone() : undefined;
  }
  async put(req: RequestInfo | URL, res: Response) {
    this.entries.delete(this.key(req));
    this.entries.set(this.key(req), res);
  }
  async delete(req: RequestInfo | URL) {
    return this.entries.delete(this.key(req));
  }
  async keys() {
    return Array.from(this.entries.keys()).map((u) => new Request(u));
  }
}

class MemoryCacheStorage {
  stores = new Map<string, MemoryCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new MemoryCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return Array.from(this.stores.keys());
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async match(req: RequestInfo | URL, opts: { cacheName?: string } = {}) {
    const names = opts.cacheName ? [opts.cacheName] : Array.from(this.stores.keys());
    for (const name of names) {
      const hit = await this.stores.get(name)?.match(req);
      if (hit) return hit;
    }
    return undefined;
  }
}

/** Respuesta "propia" (type basic) como las que ve un worker real. */
function basic(body: string, init: ResponseInit & { redirected?: boolean } = {}) {
  const res = new Response(body, init);
  Object.defineProperty(res, "type", { value: "basic" });
  if (init.redirected) Object.defineProperty(res, "redirected", { value: true });
  return res;
}

type Handler = (event: Record<string, unknown>) => void;
type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const OFFLINE_HTML = (locale: string) =>
  `<!doctype html><html lang="${locale}"><head>` +
  `<link rel="stylesheet" href="/_next/static/css/app.css">` +
  `<link rel="preload" href="/_next/static/media/font.woff2" as="font">` +
  `<script src="/_next/static/chunks/main-abc.js" async></script></head>` +
  `<body><h1>offline ${locale}</h1>` +
  `<script>self.__next_f.push([1,"0:[\\"/_next/static/chunks/app/offline-123.js\\"]"])</script></body></html>`;

function loadWorker(fetchImpl: FetchMock) {
  const handlers: Record<string, Handler> = {};
  const caches = new MemoryCacheStorage();
  const state = { skipWaiting: 0, claimed: 0, preload: 0, fetches: [] as string[] };
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    skipWaiting: async () => void state.skipWaiting++,
    clients: { claim: async () => void state.claimed++ },
    registration: { navigationPreload: { enable: async () => void state.preload++ } },
  };
  const fetch: FetchMock = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    state.fetches.push(new URL(raw, ORIGIN).pathname);
    return fetchImpl(input, init);
  };
  const context = vm.createContext({ self, caches, fetch, Response, Request, URL, Promise, console });
  // Las `const` de primer nivel no son propiedades del global: se exponen.
  vm.runInContext(
    `${SOURCE}\n;globalThis.STATIC_CACHE = STATIC_CACHE; globalThis.OFFLINE_CACHE = OFFLINE_CACHE; globalThis.MAX_STATIC_ENTRIES = MAX_STATIC_ENTRIES;`,
    context,
    { filename: "sw.js" },
  );
  const fn = <T extends (...args: never[]) => unknown>(name: string) => context[name] as T;
  return { handlers, caches, state, context, fn };
}

/** Lanza un evento y espera a lo que el worker haya pasado a waitUntil/respondWith. */
async function dispatch(
  worker: ReturnType<typeof loadWorker>,
  type: string,
  extra: Record<string, unknown> = {},
) {
  let waited: Promise<unknown> | undefined;
  let responded: Promise<Response> | undefined;
  worker.handlers[type]({
    ...extra,
    waitUntil: (p: Promise<unknown>) => (waited = p),
    respondWith: (p: Promise<Response>) => (responded = p),
  });
  if (waited) await waited;
  return responded ? await responded : undefined;
}

const req = (url: string, init: RequestInit & { mode?: string } = {}) => {
  const { mode, ...rest } = init;
  const r = new Request(new URL(url, ORIGIN), rest);
  // `mode: "navigate"` no se puede crear con `new Request`: se simula.
  if (mode) Object.defineProperty(r, "mode", { value: mode });
  return r;
};

const network: FetchMock = async (input) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname } = new URL(raw, ORIGIN);
  if (pathname.endsWith("/offline")) return basic(OFFLINE_HTML(pathname.split("/")[1]), { status: 200 });
  return basic(`net:${pathname}`, { status: 200 });
};
const offlineNetwork: FetchMock = async () => {
  throw new TypeError("Failed to fetch");
};

describe("sw.js · enrutado", () => {
  const w = loadWorker(network);
  const route = w.fn<(r: Request, o: string) => string>("routeRequest");

  it("/_next/static/** va a cache-first", () => {
    expect(route(req("/_next/static/chunks/main-abc.js"), ORIGIN)).toBe("static");
    expect(route(req("/_next/static/css/app.css"), ORIGIN)).toBe("static");
    expect(route(req("/_next/static/media/font.woff2"), ORIGIN)).toBe("static");
  });

  it("las navegaciones van a la red con respaldo offline", () => {
    expect(route(req("/es/library", { mode: "navigate" }), ORIGIN)).toBe("navigate");
    expect(route(req("/en", { mode: "navigate" }), ORIGIN)).toBe("navigate");
  });

  it("nunca intercepta /api/*, ni siquiera una navegación", () => {
    expect(route(req("/api/discover?type=movie"), ORIGIN)).toBe("bypass");
    expect(route(req("/api/auth/callback?code=x", { mode: "navigate" }), ORIGIN)).toBe("bypass");
    expect(route(req("/api"), ORIGIN)).toBe("bypass");
  });

  it("deja pasar lo que no es suyo: otros orígenes, POST, RSC, imágenes y HTML que no es navegación", () => {
    expect(route(req("https://image.tmdb.org/t/p/w342/x.jpg"), ORIGIN)).toBe("bypass");
    expect(route(req("https://cdn.example.com/_next/static/x.js"), ORIGIN)).toBe("bypass");
    expect(route(req("/api/auth/demo", { method: "POST", mode: "navigate" }), ORIGIN)).toBe("bypass");
    expect(route(req("/es/library?_rsc=abc", { headers: { RSC: "1" } }), ORIGIN)).toBe("bypass");
    expect(route(req("/_next/image?url=x&w=64"), ORIGIN)).toBe("bypass");
    expect(route(req("/icons/icon-192.png"), ORIGIN)).toBe("bypass");
    expect(route(req("/es/library"), ORIGIN)).toBe("bypass");
  });

  it("deja pasar only-if-cached fuera de same-origin (fetch la rechazaría)", () => {
    const r = req("/_next/static/chunks/a.js");
    Object.defineProperty(r, "cache", { value: "only-if-cached" });
    expect(route(r, ORIGIN)).toBe("bypass");
  });

  it("elige la página offline por idioma de la URL", () => {
    const offlinePathFor = w.fn<(p: string) => string>("offlinePathFor");
    expect(offlinePathFor("/en/library")).toBe("/en/offline");
    expect(offlinePathFor("/en")).toBe("/en/offline");
    expect(offlinePathFor("/es/u/benevi")).toBe("/es/offline");
    expect(offlinePathFor("/")).toBe("/es/offline");
    expect(offlinePathFor("/fr/x")).toBe("/es/offline");
    expect(offlinePathFor("/english")).toBe("/es/offline");
  });

  it("solo guarda respuestas propias, 200 y sin redirección", () => {
    const isCacheable = w.fn<(r: Response) => boolean>("isCacheable");
    expect(isCacheable(basic("x", { status: 200 }))).toBe(true);
    expect(isCacheable(basic("x", { status: 404 }))).toBe(false);
    expect(isCacheable(basic("x", { status: 206 }))).toBe(false);
    expect(isCacheable(basic("x", { status: 200, redirected: true }))).toBe(false);
    expect(isCacheable(new Response("x"))).toBe(false); // type "default", no "basic"
  });

  it("limpia solo las cachés de KULTURA de versiones anteriores", () => {
    const stale = w.fn<(n: string[]) => string[]>("staleCacheNames");
    const current = [w.context.STATIC_CACHE as string, w.context.OFFLINE_CACHE as string];
    expect(stale([...current, "kultura-static-v0", "kultura-offline-v0", "otra-app"])).toEqual([
      "kultura-static-v0",
      "kultura-offline-v0",
    ]);
  });

  it("saca los estáticos de la página offline, también los de la carga RSC escapada", () => {
    const extract = w.fn<(h: string) => string[]>("extractStaticAssets");
    expect(extract(OFFLINE_HTML("es"))).toEqual([
      "/_next/static/css/app.css",
      "/_next/static/media/font.woff2",
      "/_next/static/chunks/main-abc.js",
      "/_next/static/chunks/app/offline-123.js",
    ]);
    expect(extract("")).toEqual([]);
  });
});

describe("sw.js · ciclo de vida", () => {
  let w: ReturnType<typeof loadWorker>;
  beforeEach(() => {
    w = loadWorker(network);
  });

  it("install precachea /es/offline y /en/offline con sus estáticos y toma el control", async () => {
    await dispatch(w, "install");
    const offline = await w.caches.open(w.context.OFFLINE_CACHE as string);
    expect(Array.from(offline.entries.keys()).map((u) => new URL(u).pathname).sort()).toEqual([
      "/en/offline",
      "/es/offline",
    ]);
    const statics = await w.caches.open(w.context.STATIC_CACHE as string);
    expect(statics.entries.size).toBe(4);
    expect(w.state.skipWaiting).toBe(1);
  });

  it("install falla (y el navegador lo reintenta) si no llega la página offline", async () => {
    w = loadWorker(async (input) => {
      const raw = typeof input === "string" ? input : (input as Request).url;
      if (raw.includes("/en/offline")) return basic("boom", { status: 500 });
      return network(input);
    });
    await expect(dispatch(w, "install")).rejects.toThrow(/en\/offline/);
    expect(w.state.skipWaiting).toBe(0);
  });

  it("activate borra cachés viejas, activa navigation preload y reclama los clientes", async () => {
    await w.caches.open("kultura-static-v0");
    await w.caches.open("otra-app");
    await w.caches.open(w.context.STATIC_CACHE as string);
    await dispatch(w, "activate");
    expect((await w.caches.keys()).sort()).toEqual([w.context.STATIC_CACHE, "otra-app"].sort());
    expect(w.state.preload).toBe(1);
    expect(w.state.claimed).toBe(1);
  });
});

describe("sw.js · fetch", () => {
  it("cache-first en estáticos: la 2.ª vez no sale a la red", async () => {
    const w = loadWorker(network);
    const first = await dispatch(w, "fetch", { request: req("/_next/static/chunks/a.js") });
    const second = await dispatch(w, "fetch", { request: req("/_next/static/chunks/a.js") });
    expect(await first!.text()).toBe("net:/_next/static/chunks/a.js");
    expect(await second!.text()).toBe("net:/_next/static/chunks/a.js");
    expect(w.state.fetches.filter((p) => p === "/_next/static/chunks/a.js")).toHaveLength(1);
  });

  it("no guarda un estático que falla (404) y lo vuelve a pedir", async () => {
    const w = loadWorker(async () => basic("nope", { status: 404 }));
    await dispatch(w, "fetch", { request: req("/_next/static/chunks/x.js") });
    await dispatch(w, "fetch", { request: req("/_next/static/chunks/x.js") });
    expect(w.state.fetches).toHaveLength(2);
  });

  it("recorta la caché de estáticos a MAX_STATIC_ENTRIES (fuera los más antiguos)", async () => {
    const w = loadWorker(network);
    const max = w.context.MAX_STATIC_ENTRIES as number;
    for (let i = 0; i <= max + 2; i++) {
      await dispatch(w, "fetch", { request: req(`/_next/static/chunks/c${i}.js`) });
    }
    await new Promise((r) => setTimeout(r, 0));
    const statics = await w.caches.open(w.context.STATIC_CACHE as string);
    expect(statics.entries.size).toBe(max);
    expect(statics.entries.has(`${ORIGIN}/_next/static/chunks/c0.js`)).toBe(false);
  });

  it("navegación con red: responde la red y NO guarda el HTML", async () => {
    const w = loadWorker(network);
    const res = await dispatch(w, "fetch", {
      request: req("/es/library", { mode: "navigate" }),
      preloadResponse: Promise.resolve(undefined),
    });
    expect(await res!.text()).toBe("net:/es/library");
    for (const name of await w.caches.keys()) {
      const cache = await w.caches.open(name);
      expect(Array.from(cache.entries.keys()).some((u) => u.includes("/es/library"))).toBe(false);
    }
  });

  it("usa la respuesta de navigation preload si llega", async () => {
    const w = loadWorker(network);
    const res = await dispatch(w, "fetch", {
      request: req("/es/home", { mode: "navigate" }),
      preloadResponse: Promise.resolve(basic("preloaded", { status: 200 })),
    });
    expect(await res!.text()).toBe("preloaded");
    expect(w.state.fetches).toEqual([]);
  });

  it("sin red: una navegación recibe la página offline de su idioma", async () => {
    const w = loadWorker(network);
    await dispatch(w, "install");
    w.context.fetch = offlineNetwork;
    const es = await dispatch(w, "fetch", {
      request: req("/es/library", { mode: "navigate" }),
      preloadResponse: Promise.reject(new TypeError("offline")),
    });
    const en = await dispatch(w, "fetch", {
      request: req("/en/discover", { mode: "navigate" }),
      preloadResponse: Promise.resolve(undefined),
    });
    expect(await es!.text()).toContain("offline es");
    expect(await en!.text()).toContain("offline en");
  });

  it("sin red y sin página guardada: respuesta mínima 503 en el idioma de la URL", async () => {
    const w = loadWorker(offlineNetwork);
    const res = await dispatch(w, "fetch", {
      request: req("/en/library", { mode: "navigate" }),
      preloadResponse: Promise.resolve(undefined),
    });
    expect(res!.status).toBe(503);
    const html = await res!.text();
    expect(html).toContain('lang="en"');
    expect(html).toContain("offline");
  });

  it("no llama a respondWith en /api/* ni en otros orígenes", async () => {
    const w = loadWorker(network);
    expect(await dispatch(w, "fetch", { request: req("/api/search?q=dune") })).toBeUndefined();
    expect(await dispatch(w, "fetch", { request: req("https://image.tmdb.org/x.jpg") })).toBeUndefined();
    expect(w.state.fetches).toEqual([]);
  });
});
