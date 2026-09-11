// ============================================================
// KULTURA — Sentry (C1), runtime Edge (middleware.ts). Subconjunto del SDK
// compatible con el runtime Edge de Vercel (sin APIs de Node).
// Cargado por instrumentation.ts vía register().
//
// Sin NEXT_PUBLIC_SENTRY_DSN el SDK queda inactivo: no hace red, no lanza.
// ============================================================

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
