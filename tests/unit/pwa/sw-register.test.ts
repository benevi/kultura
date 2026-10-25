/**
 * MOV-2 — registro del service worker: solo en producción, tras `load`, con
 * scope raíz y sin caché HTTP para `sw.js`; `NEXT_PUBLIC_PWA_SW=0` lo retira.
 */
import { describe, it, expect, vi } from "vitest";
import { SW_URL, setupServiceWorker, swMode } from "@/components/pwa/sw-register";

function fakeWindow({ readyState = "complete", registrations = [] as unknown[] } = {}) {
  const listeners: Record<string, () => void> = {};
  const container = {
    register: vi.fn(async () => ({})),
    getRegistrations: vi.fn(async () => registrations),
  };
  const win = {
    navigator: { serviceWorker: container },
    document: { readyState },
    addEventListener: vi.fn((type: string, fn: () => void) => (listeners[type] = fn)),
  } as unknown as Window;
  return { win, container, listeners };
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

  it("interruptor: des-registra solo el worker de KULTURA", async () => {
    const ours = reg("https://kulturaapp.vercel.app/sw.js");
    const other = reg("https://kulturaapp.vercel.app/otro-worker.js");
    const { win, container } = fakeWindow({ registrations: [ours, other] });
    expect(await setupServiceWorker({ flag: "0", production: true }, win)).toBe("unregistered");
    expect(ours.unregister).toHaveBeenCalled();
    expect(other.unregister).not.toHaveBeenCalled();
    expect(container.register).not.toHaveBeenCalled();
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
