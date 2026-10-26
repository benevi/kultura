// ============================================================
// KULTURA — Sentry (C1), runtime cliente (navegador).
// `instrumentation-client.ts` es la convención de Next 15 para el código que
// corre en el navegador antes de hidratar.
//
// F-22 (REN-2): el SDK ya NO va en el JS inicial de todas las páginas
// (≈ 40 % del compartido). Aquí solo quedan dos escuchas de errores y la
// descarga diferida: `loadSentry()` (src/lib/logger.ts) pide el SDK cuando el
// hilo queda libre tras la carga, o antes si salta un error, y lo inicializa.
// Los errores ocurridos antes de que llegue se guardan (máx. 20) y se envían
// al inicializarse, así que la captura no pierde los del arranque.
//
// Sin NEXT_PUBLIC_SENTRY_DSN no se escucha ni se descarga nada.
// Sin `onRouterTransitionStart`: solo sirve para trazas de navegación y el
// tracing del navegador está fuera (`clientSentryDefines` en next.config.mjs).
// ============================================================

import { loadSentry } from "@/lib/logger";

const EARLY_ERRORS_MAX = 20;

if (process.env.NEXT_PUBLIC_SENTRY_DSN && typeof window !== "undefined") {
  const early: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    if (early.length < EARLY_ERRORS_MAX) early.push(event.error ?? event.message);
    start();
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (early.length < EARLY_ERRORS_MAX) early.push(event.reason);
    start();
  };

  let started = false;
  function start() {
    if (started) return;
    started = true;
    loadSentry()
      ?.then((Sentry) => {
        // El SDK pone sus propias escuchas globales al inicializarse.
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
        for (const err of early.splice(0)) Sentry.captureException(err);
      })
      .catch(() => {
        // Sin red o bloqueado: se vuelve a intentar con el próximo error.
        started = false;
      });
  }

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const idle = () =>
    "requestIdleCallback" in window ? window.requestIdleCallback(start, { timeout: 8000 }) : setTimeout(start, 4000);
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}
