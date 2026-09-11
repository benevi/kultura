/**
 * Tests unitarios — Logger estructurado (C2)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function setNodeEnv(value: string) {
  // NODE_ENV está tipado readonly (next-env.d.ts) — defineProperty rodea el
  // check de TS. En runtime, el proxy de process.env exige los tres flags
  // explícitos a true o lanza "only accepts a configurable, writable, and
  // enumerable data descriptor".
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV ?? "test");
  process.env.NEXT_PUBLIC_SENTRY_DSN = ORIGINAL_SENTRY_DSN;
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("logger — modo desarrollo (texto legible)", () => {
  beforeEach(() => {
    setNodeEnv("development");
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("info escribe con prefijo de scope, sin serializar a JSON", async () => {
    const { createLogger } = await import("@/lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("chat");

    log.info("mensaje de prueba", { userId: "u1" });

    expect(spy).toHaveBeenCalledWith("[chat]", "mensaje de prueba", { userId: "u1" });
  });

  it("warn usa console.warn y error usa console.error", async () => {
    const { createLogger } = await import("@/lib/logger");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("groups");

    log.warn("aviso");
    log.error("fallo");

    expect(warnSpy).toHaveBeenCalledWith("[groups]", "aviso");
    expect(errorSpy).toHaveBeenCalledWith("[groups]", "fallo");
  });

  it("el logger sin scope explícito usa 'app'", async () => {
    const { logger } = await import("@/lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("hola");

    expect(spy).toHaveBeenCalledWith("[app]", "hola");
  });
});

describe("logger — modo producción (JSON estructurado)", () => {
  beforeEach(() => {
    setNodeEnv("production");
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  });

  it("emite una línea JSON con level/scope/message/time", async () => {
    const { createLogger } = await import("@/lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("library");

    log.info("item añadido", { mediaId: "movie_1" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: "info",
      scope: "library",
      message: "item añadido",
      context: { mediaId: "movie_1" },
    });
    expect(typeof parsed.time).toBe("string");
  });

  it("serializa Error dentro del contexto a name/message/stack", async () => {
    const { createLogger } = await import("@/lib/logger");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("suggestions");

    log.error("insert falló", { err: new Error("boom") });

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.context.err.message).toBe("boom");
    expect(parsed.context.err.name).toBe("Error");
    expect(typeof parsed.context.err.stack).toBe("string");
  });

  it("error() usa console.error y warn() usa console.warn con JSON", async () => {
    const { createLogger } = await import("@/lib/logger");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("x");

    log.error("e");
    log.warn("w");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("logger — reenvío a Sentry", () => {
  it("no importa @sentry/nextjs si NEXT_PUBLIC_SENTRY_DSN no está definido", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    setNodeEnv("production");
    vi.doMock("@sentry/nextjs", () => {
      throw new Error("no debería importarse sin DSN");
    });
    vi.resetModules();
    const { createLogger } = await import("@/lib/logger");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("x");

    expect(() => log.error("fallo sin sentry")).not.toThrow();
  });

  it("reenvía captureException cuando el contexto trae un Error y hay DSN", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example@o0.ingest.sentry.io/1";
    setNodeEnv("production");
    const captureException = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({ captureException, captureMessage: vi.fn() }));
    vi.resetModules();
    const { createLogger } = await import("@/lib/logger");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("chat");
    const err = new Error("db down");

    log.error("insert falló", { err });
    // reenvío es async (import dinámico) — esperar microtask/tick.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ extra: expect.objectContaining({ message: "insert falló" }) })
    );
  });

  it("reenvía captureMessage cuando el contexto no trae un Error", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example@o0.ingest.sentry.io/1";
    setNodeEnv("production");
    const captureMessage = vi.fn();
    vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage }));
    vi.resetModules();
    const { createLogger } = await import("@/lib/logger");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("groups");

    log.error("group create error", { code: "23505" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(captureMessage).toHaveBeenCalledWith(
      "group create error",
      expect.objectContaining({ level: "error" })
    );
  });
});
