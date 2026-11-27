'use client'

// ============================================================
// KULTURA — El esqueleto del perfil en «Sala» (fase 8.5 P2, `loading.tsx`)
// La forma de lo que llega: la franja con el avatar cuadrado y el rótulo, la
// fila de números y dos filas de tarjetas con su `h2`, con los mismos
// rellenos, anchos y huecos que `SalaProfile` y `SalaRow`. Al llegar los
// datos nada cambia de sitio. Late tres veces y se queda quieto (biblia §6);
// con movimiento reducido, quieto desde el principio. Sustituye al esqueleto
// de hoy, que en dos bloques latía aunque se pidiera menos movimiento.
//
// Es adorno (`aria-hidden`): la página aún no ha llegado. Se carga con
// `next/dynamic` (`SalaProfileSkeletonLazy`), así que con la bandera apagada
// `loading.tsx` no trae las hojas de «Sala».
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

import { SalaWorkCardSkeleton } from '@/components/sala/SalaWorkCard'

const ESPERA = 'animate-sala-wait motion-reduce:animate-none'
const LINEA = 'block forced-colors:border forced-colors:border-[GrayText]'

export function SalaProfileSkeleton() {
  return (
    <main
      data-sala-profile-skeleton=""
      aria-busy="true"
      className="page-grid [&>*]:max-w-6xl py-6 md:py-8 flex flex-col gap-8 md:gap-10 font-sala-text text-sala-ink"
    >
      {/* La cabecera: misma franja, mismo avatar y mismo relleno que `SalaProfileHeader`. */}
      <div aria-hidden="true" className={ESPERA}>
        <div className="flex items-center gap-4 bg-sala-panel p-4 sm:gap-6 sm:p-6 md:p-8">
          <div className="h-[4.5rem] w-[4.5rem] shrink-0 bg-sala-background sm:h-[5.5rem] sm:w-[5.5rem] md:h-[6.5rem] md:w-[6.5rem]" />
          <div className="flex-1">
            <span className={`${LINEA} h-[1.875rem] w-3/5 bg-sala-background md:h-12`} />
          </div>
        </div>
        <div className="mt-4 sala-type-small">
          <span className={`${LINEA} h-4 w-48 max-w-full bg-sala-panel`} />
        </div>
      </div>

      {/* Los números. */}
      <div aria-hidden="true" className={`flex flex-wrap gap-x-8 gap-y-4 ${ESPERA}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <span className={`${LINEA} h-7 w-10 bg-sala-panel`} />
            <span className={`${LINEA} h-4 w-16 bg-sala-panel`} />
          </div>
        ))}
      </div>

      {[0, 1].map((row) => (
        <div key={row} aria-hidden="true">
          <div className={`mb-3 sala-type-data ${ESPERA}`}>
            <span className={`${LINEA} h-6 w-56 max-w-full bg-sala-panel`} />
          </div>
          {/* Como la fila de `SalaRow`, sin scroll: solo se ve lo que cabe. */}
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
