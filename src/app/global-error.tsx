'use client'

import { useEffect } from 'react'
// Sentry bajo demanda (F-22): un import estático metía ~15 KB gz del SDK en
// el JS inicial de todas las páginas.
import { loadSentry } from '@/lib/logger'
import { localeFromPathname } from '@/i18n/detect'
// Solo se leen cuatro textos sueltos: webpack descarta el resto del JSON en
// el bundle (este componente va en el JS de todas las páginas).
import es from '../../messages/es.json'
import en from '../../messages/en.json'

const COPY = {
  es: {
    title: es.errors.somethingWentWrong,
    description: es.errors.unexpectedDescription,
    retry: es.errors.tryAgain,
    home: es.errors.goHome,
  },
  en: {
    title: en.errors.somethingWentWrong,
    description: en.errors.unexpectedDescription,
    retry: en.errors.tryAgain,
    home: en.errors.goHome,
  },
}

/**
 * Hex de los tokens de DISENO.md. Aquí no hay hojas de estilo ni fuentes de
 * la app: este documento sustituye al layout raíz y Next no carga su CSS, así
 * que todo va en línea y con la fuente del sistema.
 */
const C = {
  bg: '#0c0d14', // --surface-base
  text: '#f4f5f8', // --text-primary
  muted: '#aeb0be', // --text-secondary
  border: '#303240', // --surface-border
  pink: '#fb40ad', // --accent-pink
  onPink: '#12080c', // --on-accent-pink
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

const button = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 44,
  padding: '0 24px',
  borderRadius: 9999,
  fontFamily: FONT,
  fontSize: 16,
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
} as const

/**
 * Idioma por la URL del navegador. No `usePathname`: si lo que falla es el
 * propio router, el hook no tiene contexto y devolvía null (y `es` en /en).
 */
function currentLocale() {
  return localeFromPathname(typeof window === 'undefined' ? null : window.location.pathname)
}

/**
 * Error que tumba el layout raíz: pinta su propio `<html>` con el idioma de
 * la URL (TXT-4) y un `<main>` con encabezado (ACC-7).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = currentLocale()
  const copy = COPY[locale]

  useEffect(() => {
    loadSentry()
      ?.then((Sentry) => Sentry.captureException(error))
      .catch(() => {})
  }, [error])

  return (
    <html lang={locale} suppressHydrationWarning style={{ backgroundColor: C.bg, colorScheme: 'dark' }}>
      <head>
        <title>{`${copy.title} · KULTURA`}</title>
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content={C.bg} />
      </head>
      <body style={{ margin: 0, backgroundColor: C.bg, color: C.text, fontFamily: FONT }}>
        <main
          id="main"
          tabIndex={-1}
          style={{
            // 100vh menos el relleno vertical (sin cambiar box-sizing): sin barra de desplazamiento.
            minHeight: 'calc(100vh - 64px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: 32,
            textAlign: 'center',
            outline: 'none',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>{copy.title}</h1>
          <p style={{ margin: 0, maxWidth: 384, color: C.muted, fontSize: 16, lineHeight: 1.5 }}>
            {copy.description}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={reset}
              style={{ ...button, border: 'none', backgroundColor: C.pink, color: C.onPink, fontWeight: 800 }}
            >
              {copy.retry}
            </button>
            <a href={`/${locale}`} style={{ ...button, border: `1px solid ${C.border}`, color: C.text }}>
              {copy.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
