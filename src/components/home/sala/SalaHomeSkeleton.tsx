'use client'

// ============================================================
// KULTURA — El esqueleto de Inicio en «Sala» (fase 8.5 I2b, `loading.tsx`)
// La forma de lo que llega: el `h1`, el hero «Continuando» (panel con la
// portada a la izquierda) y dos filas de tarjetas con su `h2`, con las mismas
// columnas, anchos y huecos que `SalaHome`. Al llegar los datos nada cambia
// de sitio. Late tres veces y se queda quieto (`SalaWorkCardSkeleton`, biblia
// §6); con movimiento reducido, quieto desde el principio.
//
// Es adorno (`aria-hidden`): la página aún no ha llegado y no hay nada que
// leer. Se carga con `next/dynamic` (`SalaHomeSkeletonLazy`), así que con la
// bandera apagada `loading.tsx` no trae las hojas de «Sala».
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

import { SalaWorkCardSkeleton } from '@/components/sala/SalaWorkCard'

/** Un bloque de relleno con el alto de línea del papel tipográfico que sustituye. */
function Line({ type, width, tone = 'bg-sala-panel' }: { type: string; width: string; tone?: string }) {
  return (
    <div className={`relative ${type}`}>
      &nbsp;
      <span className={`absolute left-0 top-1/2 h-[0.7em] -translate-y-1/2 forced-colors:border forced-colors:border-[GrayText] ${width} ${tone}`} />
    </div>
  )
}

const ESPERA = 'animate-sala-wait motion-reduce:animate-none'

export function SalaHomeSkeleton() {
  return (
    <main
      data-sala-home-skeleton=""
      aria-busy="true"
      className="page-grid [&>*]:max-w-6xl py-6 md:py-8 space-y-8 md:space-y-10 font-sala-text text-sala-ink"
    >
      <div aria-hidden="true" className={ESPERA}>
        <Line type="sala-type-heading" width="w-40" />
      </div>

      {/* El hero: mismo relleno y misma portada que `SalaHomeHero`. */}
      <div aria-hidden="true" className={`flex items-start gap-4 bg-sala-panel p-4 sm:gap-6 sm:p-6 md:gap-8 md:p-8 ${ESPERA}`}>
        <div className="aspect-[2/3] w-24 shrink-0 bg-sala-background sm:w-40 md:w-48" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Line type="sala-type-label" width="w-24" tone="bg-sala-background" />
          <Line type="sala-type-data" width="w-3/5" tone="bg-sala-background" />
          <Line type="sala-type-small" width="w-1/4" tone="bg-sala-background" />
          <div className="hidden sm:block">
            <Line type="sala-type-text" width="w-full max-w-prose" tone="bg-sala-background" />
            <Line type="sala-type-text" width="w-4/5 max-w-prose" tone="bg-sala-background" />
          </div>
          <div className="h-sala-target w-36 bg-sala-background" />
        </div>
      </div>

      {[0, 1].map((row) => (
        <div key={row} aria-hidden="true">
          <div className={`mb-3 ${ESPERA}`}>
            <Line type="sala-type-data" width="w-56 max-w-full" />
          </div>
          {/* Como `FILA` de `SalaHome`, sin scroll: solo se ve lo que cabe. */}
          <div className="-mx-2 flex gap-4 overflow-hidden px-2 pb-3 pt-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <SalaWorkCardSkeleton key={i} className="w-36 shrink-0 sm:w-40" />
            ))}
          </div>
        </div>
      ))}
    </main>
  )
}
