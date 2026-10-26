/**
 * Tests unitarios — Sentry en el navegador (REN-2).
 *
 * Se mantiene la captura de errores (init con DSN y las integraciones por
 * defecto: errores globales, promesas rechazadas, breadcrumbs) y se quita lo
 * que pesa: Session Replay (≈ 38 KB gz + rrweb grabando en búfer en cada
 * página) y el tracing del navegador (se elimina del bundle en next.config).
 *
 * F-22: el SDK ya no se inicializa al cargar `instrumentation-client.ts`, sino
 * en `loadSentry()` (src/lib/logger.ts) cuando se descarga bajo demanda; el
 * reparto de cuándo se pide está en tests/unit/perf/instrumentation-client.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

const init = vi.fn();
const replayIntegration = vi.fn(() => ({ name: "Replay" }));
const browserTracingIntegration = vi.fn(() => ({ name: "BrowserTracing" }));
let client: object | undefined;

vi.mock("@sentry/nextjs", () => ({
  init: (opts: unknown) => {
    init(opts);
    client = {};
  },
  getClient: () => client,
  replayIntegration,
  browserTracingIntegration,
}));

let options: Record<string, unknown>;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@o0.ingest.sentry.io/1";
  const { loadSentry, _resetSentryForTests } = await import("@/lib/logger");
  _resetSentryForTests();
  await loadSentry();
  // Una segunda petición (otro error, o el arranque diferido) no reinicia.
  _resetSentryForTests();
  await loadSentry();
  options = init.mock.calls[0]?.[0] as Record<string, unknown>;
});

describe("Sentry en el navegador (loadSentry)", () => {
  it("inicializa Sentry una vez con el DSN público (la captura de errores sigue)", () => {
    expect(init).toHaveBeenCalledTimes(1);
    expect(options.dsn).toBe("https://key@o0.ingest.sentry.io/1");
  });

  it("no monta Session Replay", () => {
    expect(replayIntegration).not.toHaveBeenCalled();
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
    const integrations = (options.integrations as unknown[] | undefined) ?? [];
    expect(integrations).toHaveLength(0);
  });

  it("no pide trazas de rendimiento en el navegador", () => {
    expect(browserTracingIntegration).not.toHaveBeenCalled();
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("tracesSampler");
  });

  it("no desactiva las integraciones por defecto (errores globales y promesas)", () => {
    expect(options.defaultIntegrations).not.toBe(false);
  });
});
