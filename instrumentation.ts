/**
 * Next.js instrumentation hook (estable en 14.2 — no requiere
 * `experimental.instrumentationHook`). Corre una vez al arrancar el server.
 *
 * Fail-fast de los secretos server-only: si falta o es inválida una var crítica
 * (E24), el server no arranca y el log lista exactamente qué falla. Solo en el
 * runtime Node.js (el Edge runtime no tiene los secretos server-only).
 *
 * También inicializa Sentry (C1) para cada runtime — server.config para
 * Route Handlers/Server Components, edge.config para middleware.ts. Sin
 * NEXT_PUBLIC_SENTRY_DSN ambos quedan inactivos (no-op).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("./src/lib/env");
    parseServerEnv();
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Captura errores de Route Handlers / Server Components que Next.js no
 * expone a un error.tsx (p.ej. errores lanzados fuera del árbol de React).
 * Reenvía a Sentry — no-op si no hay DSN configurado.
 */
export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
