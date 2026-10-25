// ============================================================
// KULTURA — Sentry (C1), runtime cliente (navegador).
// `instrumentation-client.ts` es la convención de Next 15 para el código que
// corre en el navegador antes de hidratar; sustituye a `sentry.client.config.ts`
// (que el plugin de @sentry/nextjs inyectaba y ya marca como obsoleto).
//
// Sin NEXT_PUBLIC_SENTRY_DSN el SDK queda inactivo: no hace red, no lanza.
// Mismo patrón de degradación que ANTHROPIC_API_KEY/COMICVINE_KEY (env.server.ts).
//
// Sin `onRouterTransitionStart`: solo sirve para trazas de navegación y el
// tracing del navegador está fuera (ver abajo).
// ============================================================

import * as Sentry from "@sentry/nextjs";

// REN-2: solo captura de errores (excepciones globales, promesas rechazadas y
// `Sentry.captureException` de global-error.tsx y logger.ts). Fuera:
// - Session Replay: ≈ 38 KB gz y, con `replaysOnErrorSampleRate`, rrweb
//   grabando en búfer (MutationObserver) en cada página aunque no haya error.
// - Trazas del navegador: el código se elimina en el build (ver
//   `clientSentryDefines` en next.config.mjs) y sin `tracesSampleRate` el SDK
//   no intenta muestrear. Las trazas de servidor y edge se mantienen.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
