'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { cn } from '@/lib/utils/index'
// Sentry bajo demanda (F-22): no entra en el JS inicial de las páginas.
import { loadSentry } from '@/lib/logger'
// La app todavía no carga «Sala» en el layout: los papeles `--sala-*` y sus
// fuentes vienen con la pieza que los usa. Si el layout los carga más
// adelante, estas importaciones no duplican nada (el CSS se sirve una vez).
import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

interface ErrorStateProps {
  /** El error que recibe el `error.tsx`: se envía a Sentry (saneamiento 10.1). */
  error?: Error & { digest?: string }
  reset: () => void
  /** Ocupa más alto: el `error.tsx` de `[locale]`, sin el envoltorio de la app. */
  fullPage?: boolean
  /** Destino de la salida. Con sesión, Inicio; en páginas públicas, la portada (`/`). */
  homeHref?: '/home' | '/'
}

/**
 * Estado de error de los `error.tsx` (fase 8.4, C11): el `SalaBlockState` de
 * error con el título como `h1`, que recibe el foco al aparecer para que el
 * lector de pantalla diga qué ha pasado; una explicación, «Reintentar»
 * (`reset`) y la salida a Inicio. Pinta su propio fondo de «Sala» para que
 * valga en claro y en oscuro dentro del envoltorio de hoy.
 *
 * La salida es un `<a>` normal con el aspecto de `SalaButton`, no un
 * `SalaLink`: este límite se pinta también en las rutas cacheables (F-22), donde
 * no puede entrar el `Link` de next-intl (la página de destino heredaría la CSP
 * de la de origen; `tests/unit/csp/static-pages.test.ts`). Además, tras un error
 * conviene recargar el documento y empezar sin el estado de cliente que lo
 * provocó.
 */
export function ErrorState({ error, reset, fullPage = false, homeHref = '/home' }: ErrorStateProps) {
  const t = useTranslations('errors')
  const locale = useParams<{ locale?: string }>()?.locale
  const home = `${locale ? `/${locale}` : ''}${homeHref === '/' && locale ? '' : homeHref}`

  // Saneamiento 10.1: sin esto, un error que pinta esta pantalla no llegaba a
  // Sentry (Next solo reenvía al servidor los de servidor, con `digest`).
  // Sin DSN `loadSentry()` es null y no se descarga nada.
  useEffect(() => {
    if (!error) return
    loadSentry()
      ?.then((Sentry) =>
        Sentry.captureException(error, {
          tags: { boundary: 'page' },
          extra: error.digest ? { digest: error.digest } : undefined,
        })
      )
      .catch(() => {})
  }, [error])

  return (
    <div className="bg-sala-background px-sala-margin text-sala-ink">
      <SalaBlockState
        tone="error"
        headingLevel={1}
        focusTitle
        className={cn('justify-center', fullPage ? 'min-h-[60vh]' : 'min-h-[40vh]')}
        title={t('somethingWentWrong')}
        description={<p>{t('unexpectedDescription')}</p>}
        action={<SalaButton onClick={reset}>{t('tryAgain')}</SalaButton>}
        secondary={
          <SalaButton variant="secondary" asChild>
            <a href={home}>{t('goHome')}</a>
          </SalaButton>
        }
      />
    </div>
  )
}
