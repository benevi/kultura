// ============================================================
// KULTURA — Sentry (C1), runtime servidor (Node.js — Route Handlers,
// Server Components). Cargado por instrumentation.ts vía register().
//
// Sin NEXT_PUBLIC_SENTRY_DSN el SDK queda inactivo: no hace red, no lanza.
// ============================================================

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
