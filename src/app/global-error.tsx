'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { bricolageGrotesque, figtree } from '@/app/fonts'
import { KButton } from '@/components/ui/KButton'
import { localeFromPathname } from '@/i18n/detect'
// Solo se leen cuatro textos sueltos: webpack descarta el resto del JSON en
// el bundle (este componente va en el JS de todas las páginas).
import es from '../../messages/es.json'
import en from '../../messages/en.json'
import './globals.css'

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
 * Error que tumba el layout raíz: sustituye al documento entero, así que pinta
 * su propio `<html>` con el idioma de la URL (TXT-4), las fuentes y los tokens
 * de la app, y un `<main>` con encabezado (ACC-7).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = localeFromPathname(usePathname())
  const copy = COPY[locale]

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang={locale}>
      <head>
        <title>{`${copy.title} · KULTURA`}</title>
        <meta name="robots" content="noindex" />
      </head>
      <body
        className={`${bricolageGrotesque.variable} ${figtree.variable} font-body bg-surface-base text-text-primary antialiased`}
      >
        <main
          id="main"
          tabIndex={-1}
          className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
        >
          <h1 className="font-display text-2xl font-bold text-text-primary">{copy.title}</h1>
          <p className="max-w-sm text-text-secondary">{copy.description}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <KButton variant="primary" size="lg" onClick={reset}>
              {copy.retry}
            </KButton>
            <KButton asChild variant="secondary" size="lg">
              <a href={`/${locale}`}>{copy.home}</a>
            </KButton>
          </div>
        </main>
      </body>
    </html>
  )
}
