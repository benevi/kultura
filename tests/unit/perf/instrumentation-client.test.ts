// @vitest-environment jsdom
/**
 * F-22 (REN-2) — Sentry fuera del JS inicial.
 * `instrumentation-client.ts` ya no importa el SDK: lo pide `loadSentry()`
 * cuando el hilo queda libre tras la carga o con el primer error, y envía los
 * errores que ocurrieron antes de que llegara.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const ORIGINAL_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

const captureException = vi.fn();
const sentryModule = { captureException, captureMessage: vi.fn(), getClient: () => undefined, init: vi.fn() };
const loadSentry = vi.fn(() => Promise.resolve(sentryModule));

vi.mock("@/lib/logger", () => ({ loadSentry: () => loadSentry() }));

beforeEach(() => {
  vi.resetModules();
  loadSentry.mockClear();
  captureException.mockClear();
});

afterEach(() => {
  process.env.NEXT_PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("instrumentation-client — Sentry perezoso", () => {
  it("no importa @sentry/nextjs de forma estática (fuera del JS compartido)", () => {
    const src = readFileSync(resolve(ROOT, "instrumentation-client.ts"), "utf8");
    expect(src).not.toMatch(/from ["']@sentry\/nextjs["']/);
  });

  it("el logger tampoco lo importa de forma estática", () => {
    const logger = readFileSync(resolve(ROOT, "src/lib/logger.ts"), "utf8");
    expect(logger).not.toMatch(/^import .*@sentry\/nextjs/m);
  });

  it("con DSN: no descarga nada al importar y sí con el primer error, que se envía", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://k@o1.ingest.de.sentry.io/1";
    await import("../../../instrumentation-client");
    expect(loadSentry).not.toHaveBeenCalled();

    const err = new Error("arranque");
    window.dispatchEvent(new ErrorEvent("error", { error: err, message: "arranque" }));
    await flush();

    expect(loadSentry).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err);
  });

  it("con DSN: tras la carga, lo pide cuando el hilo queda libre", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://k@o1.ingest.de.sentry.io/1";
    vi.useFakeTimers();
    try {
      await import("../../../instrumentation-client");
      // jsdom: el documento ya está cargado y no hay requestIdleCallback → setTimeout.
      expect(loadSentry).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      expect(loadSentry).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sin DSN: ni escucha ni descarga", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const listen = vi.spyOn(window, "addEventListener");
    await import("../../../instrumentation-client");
    await flush();
    expect(listen).not.toHaveBeenCalledWith("error", expect.anything());
    expect(loadSentry).not.toHaveBeenCalled();
    listen.mockRestore();
  });

  it("zod sin compilación JIT (no prueba Function(\"\"), que la CSP bloquea)", async () => {
    await import("../../../instrumentation-client");
    const { config } = await import("zod/v4/core");
    expect(config().jitless).toBe(true);
  });
});
