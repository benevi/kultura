/**
 * MOV-2 — registro del service worker: solo en producción, tras `load`, con
 * scope raíz y sin caché HTTP para `sw.js`; `NEXT_PUBLIC_PWA_SW=0` lo retira.
 */
import { describe, it, expect, vi } from "vitest";
import { SW_URL, deleteWorkerCaches, isServiceWorkerEnabled, setupServiceWorker, swMode } from "@/components/pwa/sw-register";

function fakeWindow({ readyState = "complete", registrations = [] as unknown[], cacheNames = [] as string[] } = {}) {
  const listeners: Record<string, () => void> = {};
  const container = {
    register: vi.fn(async () => ({})),
    getRegistrations: vi.fn(async () => registrations),
  };
  const names = new Set(cacheNames);
  const caches = {
    keys: vi.fn(async () => Array.from(names)),
    delete: vi.fn(async (n: string) => names.delete(n)),
  };
  const win = {
    navigator: { serviceWorker: container },
    document: { readyState },
    caches,
    addEventListener: vi.fn((type: string, fn: () => void) => (listeners[type] = fn)),
  } as unknown as Window;
  return { win, container, listeners, names };
}

const reg = (scriptURL: string) => ({ active: { scriptURL }, unregister: vi.fn(async () => true) });

describe("swMode", () => {
  it("producción registra, desarrollo no, y la bandera a 0 des-registra siempre", () => {
    expect(swMode({ flag: undefined, production: true })).toBe("register");
    expect(swMode({ flag: "1", production: true })).toBe("register");
    expect(swMode({ flag: undefined, production: false })).toBe("skip");
    expect(swMode({ flag: "0", production: true })).toBe("unregister");
    expect(swMode({ flag: "0", production: false })).toBe("unregister");
  });
});

describe("setupServiceWorker", () => {
  it("registra /sw.js con scope / y updateViaCache none", async () => {
    const { win, container } = fakeWindow();
    expect(await setupServiceWorker({ flag: undefined, production: true }, win)).toBe("scheduled");
    expect(container.register).toHaveBeenCalledWith(SW_URL, { scope: "/", updateViaCache: "none" });
  });

  it("si la página aún carga, espera a `load` para no competir con ella", async () => {
    const { win, container, listeners } = fakeWindow({ readyState: "interactive" });
    await setupServiceWorker({ flag: undefined, production: true }, win);
    expect(container.register).not.toHaveBeenCalled();
    listeners.load();
    expect(container.register).toHaveBeenCalledTimes(1);
  });

  it("en desarrollo no registra nada", async () => {
    const { win, container } = fakeWindow();
    expect(await setupServiceWorker({ flag: undefined, production: false }, win)).toBe("skipped");
    expect(container.register).not.toHaveBeenCalled();
  });

  it("interruptor: des-registra solo el worker de KULTURA y borra solo sus cachés", async () => {
    const ours = reg("https://kulturaapp.vercel.app/sw.js");
    const other = reg("https://kulturaapp.vercel.app/otro-worker.js");
    const { win, container, names } = fakeWindow({
      registrations: [ours, other],
      cacheNames: ["kultura-static-v1", "kultura-offline-v1", "otra-cosa"],
    });
    expect(await setupServiceWorker({ flag: "0", production: true }, win)).toBe("unregistered");
    expect(ours.unregister).toHaveBeenCalled();
    expect(other.unregister).not.toHaveBeenCalled();
    expect(container.register).not.toHaveBeenCalled();
    expect(Array.from(names)).toEqual(["otra-cosa"]);
  });

  it("interruptor sin Cache Storage o con cachés bloqueadas: no lanza", async () => {
    const { win } = fakeWindow({ registrations: [reg("https://k.app/sw.js")] });
    (win as unknown as { caches: { keys: () => Promise<never> } }).caches.keys = async () => {
      throw new Error("SecurityError");
    };
    await expect(setupServiceWorker({ flag: "0", production: true }, win)).resolves.toBe("unregistered");
    await expect(deleteWorkerCaches({} as Window)).resolves.toBeUndefined();
  });

  it("isServiceWorkerEnabled: solo \"0\" lo apaga", () => {
    expect(isServiceWorkerEnabled(undefined)).toBe(true);
    expect(isServiceWorkerEnabled("1")).toBe(true);
    expect(isServiceWorkerEnabled("")).toBe(true);
    expect(isServiceWorkerEnabled("0")).toBe(false);
    expect(isServiceWorkerEnabled(" 0 ")).toBe(false);
  });

  it("navegador sin service workers: nada", async () => {
    const win = { navigator: {}, document: { readyState: "complete" } } as unknown as Window;
    expect(await setupServiceWorker({ flag: undefined, production: true }, win)).toBe("unsupported");
  });

  it("un registro que falla no lanza (la app sigue igual)", async () => {
    const { win, container } = fakeWindow();
    container.register.mockRejectedValueOnce(new Error("SecurityError"));
    await expect(setupServiceWorker({ flag: undefined, production: true }, win)).resolves.toBe("scheduled");
  });
});

describe("GET /sw-config.json", () => {
  it("dice al worker si sigue activado, sin caché", async () => {
    const { GET } = await import("@/app/sw-config.json/route");
    const prev = process.env.NEXT_PUBLIC_PWA_SW;
    try {
      delete process.env.NEXT_PUBLIC_PWA_SW;
      let res = GET();
      expect(await res.json()).toEqual({ enabled: true });
      expect(res.headers.get("cache-control")).toContain("no-store");
      process.env.NEXT_PUBLIC_PWA_SW = "0";
      res = GET();
      expect(await res.json()).toEqual({ enabled: false });
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_PWA_SW;
      else process.env.NEXT_PUBLIC_PWA_SW = prev;
    }
  });
});
