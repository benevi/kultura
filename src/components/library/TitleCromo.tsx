'use client'

// ============================================================
// KULTURA — El cromo de la ficha (el anverso; la ficha es el reverso)
//
// La portada en grande, con la forma que le da TU estado (DISENO.md):
// - fuera de tu biblioteca o pendiente: el cromo sostenido sobre su hueco
//   (contorno discontinuo detrás, el cromo algo alzado y girado);
// - en curso: puesto, con la tira de progreso en el color del formato;
// - completado: pegado (y con brillo si es un 10/10);
// - abandonado: con la esquina doblada, legible y reversible.
// Al cambiar de estado se pega (`animate-paste`); al quitarlo vuelve a
// sostenerse sobre el hueco con una transición de 180 ms. Con movimiento
// reducido, todo instantáneo (globals.css).
// ============================================================

import { useEffect, useRef } from 'react'
import { Cromo } from '@/components/album/Cromo'
import { albumShapeFor, isFoil } from '@/lib/design/album'
import { entryRating10 } from '@/lib/library/rating'
import { progressRatio, type LibraryEntryWithProgress } from '@/lib/library/progress'
import { cn } from '@/lib/utils/index'
import type { MediaType } from '@/types/media'
import type { LibraryEntry, LibraryStatus } from '@/types/library'
import { useTitleEntry } from './entry-context'
import { useProgressLabel } from './useProgressLabel'

export interface TitleCromoProps {
  id: string
  type: MediaType
  title: string
  poster?: string | null
  /** Entrada de partida (fuera de la ficha, o sin contexto). */
  initialEntry?: LibraryEntry | null
  /** «Abandonado, puedes retomarlo» y «Brillante: 10 de 10» (namespace `album`). */
  labels: { folded: string; foil: string }
  sizes: string
  priority?: boolean
  className?: string
}

export function TitleCromo({ id, type, title, poster, initialEntry = null, labels, sizes, priority, className }: TitleCromoProps) {
  const shared = useTitleEntry()
  const entry = shared ? shared.entry : initialEntry
  const status: LibraryStatus | null = entry?.status ?? null
  const progressLabel = useProgressLabel()
  const lift = useRef<HTMLDivElement>(null)
  const previous = useRef(status)

  // Pegado al cambiar de estado (no al cargar). Reiniciar la clase vuelve a
  // reproducir la animación aunque ya estuviera puesta.
  useEffect(() => {
    if (previous.current === status) return
    previous.current = status
    const el = lift.current
    if (!el || status === null) return
    el.classList.remove('animate-paste')
    void el.offsetWidth
    el.classList.add('animate-paste')
    const done = () => el.classList.remove('animate-paste')
    el.addEventListener('animationend', done, { once: true })
    return () => el.removeEventListener('animationend', done)
  }, [status])

  const shape = status === null ? 'slot' : albumShapeFor(status)
  const held = shape === 'slot'
  const rating10 = entry ? entryRating10(entry) : null
  const foil = shape === 'pasted' && isFoil(rating10)
  const progress = entry ? (entry as LibraryEntryWithProgress).progress ?? null : null
  const ratio = shape === 'placed' ? progressRatio(type, progress) : null

  return (
    <div data-title-cromo={shape} className={cn('relative', className)}>
      {/* El hueco del álbum, detrás: se ve mientras el cromo no está pegado. */}
      <div aria-hidden="true" className="absolute inset-0 rounded-cromo border-2 border-dashed border-slot-line" />
      <div
        ref={lift}
        className={cn(
          'relative transition-transform duration-fast ease-out',
          held && '-translate-x-1.5 -translate-y-2 -rotate-2'
        )}
      >
        <Cromo
          title={title}
          seed={id}
          poster={poster}
          sizes={sizes}
          priority={priority}
          still
          state={shape === 'slot' ? 'pasted' : shape}
          format={type}
          progress={ratio ?? undefined}
          progressLabel={ratio !== null ? progressLabel(type, progress) : undefined}
          stateLabel={shape === 'folded' ? labels.folded : foil ? labels.foil : undefined}
          foil={foil}
        />
      </div>
    </div>
  )
}
