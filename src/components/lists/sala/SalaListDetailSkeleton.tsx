'use client'

// ============================================================
// KULTURA — El esqueleto de /lists/[id] en «Sala» (fase 8.5 L3, `loading.tsx`)
// La forma de lo que llega: el nombre, la línea de datos y los botones, y la
// rejilla de pósters 2:3 con la misma rejilla que `SalaListDetail`. Late tres
// veces y se queda quieto (biblia §6); con movimiento reducido, quieto desde
// el principio. La carga se anuncia una vez (`role="status"`).
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

const ESPERA = 'animate-sala-wait motion-reduce:animate-none'
const LINEA = 'block forced-colors:border forced-colors:border-[GrayText]'
/** La misma rejilla que `SalaListDetail` (no se importa: arrastraría la ficha). */
const REJILLA = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

export function SalaListDetailSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <main
      data-sala-list-detail-skeleton=""
      aria-busy="true"
      className="page-grid [&>*]:max-w-6xl py-6 md:py-8 flex flex-col gap-10 font-sala-text text-sala-ink"
    >
      <p role="status" className="sr-only">
        {loadingLabel}
      </p>
      <div aria-hidden="true" className={`flex flex-col gap-4 ${ESPERA}`}>
        <span className={`${LINEA} h-9 w-2/3 max-w-md bg-sala-panel md:h-12`} />
        <span className={`${LINEA} h-4 w-56 max-w-full bg-sala-panel`} />
        <span className="flex flex-wrap gap-3">
          <span className={`${LINEA} h-12 w-40 bg-sala-panel`} />
          <span className={`${LINEA} h-12 w-36 bg-sala-panel`} />
        </span>
      </div>
      <div aria-hidden="true" className={`flex flex-col gap-4 ${ESPERA}`}>
        <span className={`${LINEA} h-7 w-32 bg-sala-panel`} />
        <div className={REJILLA}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <span className={`${LINEA} aspect-[2/3] bg-sala-panel`} />
              <span className={`${LINEA} h-5 w-4/5 bg-sala-panel`} />
              <span className={`${LINEA} h-4 w-3/5 bg-sala-panel`} />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
