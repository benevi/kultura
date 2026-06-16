/**
 * Next.js instrumentation hook (estable en 14.2 — no requiere
 * `experimental.instrumentationHook`). Corre una vez al arrancar el server.
 *
 * Fail-fast de los secretos server-only: si falta o es inválida una var crítica
 * (E24), el server no arranca y el log lista exactamente qué falla. Solo en el
 * runtime Node.js (el Edge runtime no tiene los secretos server-only).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseServerEnv } = await import("./src/lib/env");
    parseServerEnv();
  }
}
