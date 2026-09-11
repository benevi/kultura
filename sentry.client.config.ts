// ============================================================
// KULTURA — Sentry (C1), runtime cliente (navegador).
// Cargado automáticamente por el plugin de @sentry/nextjs (ver
// withSentryConfig en next.config.mjs) — no requiere import manual.
//
// Sin NEXT_PUBLIC_SENTRY_DSN el SDK queda inactivo: no hace red, no lanza.
// Mismo patrón de degradación que ANTHROPIC_API_KEY/COMICVINE_KEY (env.ts).
// ============================================================

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Trazas de rendimiento: 10% del tráfico. Suficiente para detectar
  // regresiones sin disparar el volumen (y el coste) del plan gratuito.
  tracesSampleRate: 0.1,

  // Replay de sesión: solo en las sesiones donde ya ocurrió un error, nunca
  // en tráfico normal — evita capturar interacciones de usuarios reales
  // (chat, biblioteca) salvo cuando hay algo que depurar.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
});
