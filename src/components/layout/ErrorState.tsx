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
 * Tres pósteres «rotos»: los gradientes de dos paradas del mismo matiz de
 * DISENO.md, rotados en abanico, el central partido en dos, y la pegatina
 * colgante. Decorativo.
 */
function BrokenPosters({ sticker }: { sticker: string }) {
  const poster = 'absolute w-16 h-24 rounded-[14px]'
  return (
    <div aria-hidden className="relative w-48 h-32 mx-auto">
      <span
        className={`${poster} left-3 top-5 -rotate-[10deg]`}
        style={{ background: 'linear-gradient(155deg, oklch(62% 0.19 300), oklch(40% 0.12 300))' }}
      />
      <span
        className={`${poster} right-3 top-5 rotate-[8deg]`}
        style={{ background: 'linear-gradient(155deg, oklch(72% 0.19 55), oklch(48% 0.12 55))' }}
      />
      {/* Póster central «roto»: dos mitades separadas por una grieta. */}
      <span
        className="absolute left-1/2 top-2 -ml-8 w-16 h-12 rounded-t-[14px] -rotate-[4deg] origin-bottom-left"
        style={{ background: 'linear-gradient(155deg, oklch(68% 0.24 350), oklch(55% 0.2 350))' }}
      />
      <span
        className="absolute left-1/2 top-[3.6rem] -ml-8 w-16 h-12 rounded-b-[14px] rotate-[5deg] origin-top-right"
        style={{ background: 'linear-gradient(155deg, oklch(55% 0.2 350), oklch(45% 0.16 350))' }}
      />
      <span
        className="absolute -top-1 left-1 -rotate-[8deg] rounded-full bg-accent-lime px-3 py-1 text-xs font-extrabold text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,0.4)]"
      >
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
      <BrokenPosters sticker={tNav('oops')} />
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl font-bold text-text-primary focus:outline-none"
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
