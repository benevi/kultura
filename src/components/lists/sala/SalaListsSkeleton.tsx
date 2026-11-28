'use client'

// ============================================================
// KULTURA — El esqueleto de /lists en «Sala» (fase 8.5 L1, `loading.tsx`)
// La forma de lo que llega: el rótulo y el botón, y la rejilla de tarjetas
// con su mosaico de 2 × 2 y dos líneas, con la misma rejilla que
// `SalaListsIndex`. Late tres veces y se queda quieto (biblia §6); con
// movimiento reducido, quieto desde el principio. La carga se anuncia una vez
// (`role="status"`), no una por tarjeta.
//
// Se carga con `next/dynamic` (`SalaListsSkeletonLazy`): con la bandera
// apagada `loading.tsx` no trae las hojas de «Sala».
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

const ESPERA = 'animate-sala-wait motion-reduce:animate-none'
const LINEA = 'block forced-colors:border forced-colors:border-[GrayText]'
/** La misma rejilla que `SALA_LISTS_GRID` (no se importa: arrastraría el índice). */
const REJILLA = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'

export function SalaListsSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <main
      data-sala-lists-skeleton=""
      aria-busy="true"
      className="page-grid [&>*]:max-w-6xl py-6 md:py-8 font-sala-text text-sala-ink"
    >
      <p role="status" className="sr-only">
        {loadingLabel}
      </p>
      <div aria-hidden="true" className={`mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${ESPERA}`}>
        <span className={`${LINEA} h-9 w-56 max-w-full bg-sala-panel md:h-12`} />
        <span className={`${LINEA} h-12 w-36 bg-sala-panel`} />
      </div>
      <div aria-hidden="true" className={`${REJILLA} ${ESPERA}`}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-0.5">
              {[0, 1, 2, 3].map((j) => (
                <span key={j} className={`${LINEA} aspect-[2/3] bg-sala-panel`} />
              ))}
            </div>
            <span className={`${LINEA} h-5 w-4/5 bg-sala-panel`} />
            <span className={`${LINEA} h-4 w-3/5 bg-sala-panel`} />
          </div>
        ))}
      </div>
    </main>
  )
}
