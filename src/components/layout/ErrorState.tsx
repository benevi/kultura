'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { KButton } from '@/components/ui/KButton'

interface ErrorStateProps {
  reset: () => void
  minHeight?: string
  /** Destino del botón secundario. Con sesión, Inicio; en páginas públicas, la portada (`/`). */
  homeHref?: string
}

/**
 * Tres cromos que se han despegado: borde blanco de cromo, tintas planas del
 * álbum (cian, rosa, amarillo), el central doblado por la esquina, y el
 * número de hueco que se ha quedado vacío. Decorativo; sin degradados ni
 * sombras.
 */
function LooseCromos({ sticker }: { sticker: string }) {
  const cromo = 'absolute w-16 h-24 rounded-cromo border-[3px] border-cromo-border'
  return (
    <div aria-hidden className="relative w-48 h-32 mx-auto">
      <span className={`${cromo} left-3 top-5 -rotate-[10deg] bg-album-cyan`} />
      <span className={`${cromo} right-3 top-5 rotate-[8deg] bg-album-yellow`} />
      <span className={`${cromo} cromo-folded left-1/2 top-2 -ml-8 -rotate-[4deg] bg-album-pink`} />
      <span className="absolute -top-1 left-1 -rotate-[8deg] inline-flex h-7 items-center rounded-cromo bg-album-white px-2.5 text-xs font-bold text-album-navy">
        {sticker}
      </span>
    </div>
  )
}

/**
 * Estado de error de los `error.tsx` (DIS-13): ilustración, título, «Reintentar»
 * (primario) e «Ir al inicio» (secundario). El título recibe el foco al
 * aparecer para que el lector de pantalla anuncie qué ha pasado.
 */
export function ErrorState({ reset, minHeight = 'min-h-[40vh]', homeHref = '/home' }: ErrorStateProps) {
  const t = useTranslations('errors')
  const tNav = useTranslations('nav')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const locale = useParams<{ locale?: string }>()?.locale
  // Enlace normal (recarga completa) a propósito: tras un error conviene
  // empezar de cero, sin el estado de cliente que lo provocó.
  const home = `${locale ? `/${locale}` : ''}${homeHref === '/' && locale ? '' : homeHref}`

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className={`flex flex-col items-center justify-center ${minHeight} gap-6 px-4 py-10 text-center`}>
      <LooseCromos sticker={tNav('oops')} />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl text-balance text-text-primary focus:outline-none"
      >
        {t('somethingWentWrong')}
      </h1>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        <KButton size="lg" onClick={reset}>
          {t('tryAgain')}
        </KButton>
        <KButton size="lg" variant="secondary" asChild>
          <a href={home}>{t('goHome')}</a>
        </KButton>
      </div>
    </div>
  )
}
