'use client'

// ============================================================
// KULTURA — Vercel Web Analytics y Speed Insights sin tokens en las URL (F-28)
//
// Las páginas del correo (/[locale]/email/unsubscribe y /[locale]/email/confirm)
// llevan en `?t=` un enlace firmado que vale para darse de baja o activar el
// correo de una persona. Las páginas vistas y las métricas de rendimiento se
// mandan sin query en esas rutas y, en cualquier otra, sin el parámetro `t`;
// el resto (UTM incluidos) sigue igual. `beforeSend` es una función: por eso
// este envoltorio de cliente. Los dos scripts son del mismo origen
// (`/_vercel/insights`, `/_vercel/speed-insights`): la CSP no cambia.
// ============================================================

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const EMAIL_PAGES = /^\/(?:es|en)\/email(?:\/|$)/

export function stripSensitiveQuery<T extends { url: string }>(event: T): T {
  try {
    const url = new URL(event.url)
    if (EMAIL_PAGES.test(url.pathname)) url.search = ''
    else url.searchParams.delete('t')
    return { ...event, url: url.toString() }
  } catch {
    return event
  }
}

export function VercelAnalytics() {
  return (
    <>
      <Analytics beforeSend={stripSensitiveQuery} />
      <SpeedInsights beforeSend={stripSensitiveQuery} />
    </>
  )
}
