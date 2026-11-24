'use client'

// ============================================================
// KULTURA — SalaLibraryGrid (fase 8.5 B1, bandera SALA_BIBLIOTECA)
// La rejilla de la Biblioteca en «Sala»: `SalaWorkList` con una
// `SalaWorkCard` por título y, en cada una, la edición rápida de estado y
// nota (`SalaLibraryQuickEdit`, con el diálogo de la ficha).
//
// Este módulo solo se carga con `next/dynamic` (`SalaLibraryGridLazy`): con
// la bandera apagada la biblioteca no descarga su código ni sus hojas, y Next
// solo enlaza `tokens.css`, `fonts.css` y `title.css` en la petición que pinta
// la rejilla (el respaldo sin portada lleva el título en Anybody).
//
// - Un enlace por tarjeta (el título) y la acción fuera de él, después en el
//   orden del teclado.
// - El formato, el estado y la nota se dicen con palabras, nunca solo con un
//   color ni con un símbolo («Tu nota: 4 de 5»).
// - Todas las portadas en 2/3 aunque se mezclen formatos: las filas cuadran.
// - Los avisos («Guardado en tu biblioteca») van por `SalaToastProvider`.
// - B2: en las obras en curso, el progreso que ya trae la página («T2 · E5»,
//   «Cap. 34 · Vol. 5», «Pág. 120 de 350»), con «Progreso» para el lector.
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'
import '@/styles/sala/title.css'

import { useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SalaWorkList } from '@/components/sala/SalaWorkList'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaToastProvider, type SalaToastLabels } from '@/components/sala/SalaToast'
import { SalaLibraryQuickEdit } from '@/components/library/sala/SalaLibraryQuickEdit'
import { useProgressLabel } from '@/components/library/useProgressLabel'
import { hasProgress, progressKindFor, type LibraryEntryWithProgress } from '@/lib/library/progress'
import { entryRating10 } from '@/lib/library/sort'
import type { LibraryEntry, RatingScale } from '@/types/library'
import type { MediaType } from '@/types/media'

export interface SalaLibraryGridProps {
  /** Los títulos que se ven (ya filtrados y ordenados), con su progreso si lo hay. */
  entries: LibraryEntryWithProgress[]
  /** Escala de notas de la persona (Ajustes, F-28). */
  scale: RatingScale
  /** La entrada tal como quedó guardada. */
  onSaved: (entry: LibraryEntry) => void
  /** Textos de la zona de avisos, ya traducidos (los pone el servidor). */
  toastLabels: SalaToastLabels
}

/** Dos columnas en el móvil: con tres y el botón de 48 px encima, la portada casi no se ve. */
const REJILLA = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
const SIZES = '(min-width: 1280px) 15vw, (min-width: 1024px) 18vw, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw'
/** Las que se ven sin hacer scroll. */
const PRIORITY_CARDS = 6

function parseMediaId(mediaId: string): { type: MediaType; externalId: string } {
  const idx = mediaId.indexOf('_')
  return { type: mediaId.slice(0, idx) as MediaType, externalId: mediaId.slice(idx + 1) }
}

export function SalaLibraryGrid({ toastLabels, ...props }: SalaLibraryGridProps) {
  return (
    <SalaToastProvider labels={toastLabels}>
      <SalaLibraryGridView {...props} />
    </SalaToastProvider>
  )
}

function SalaLibraryGridView({ entries, scale, onSaved }: Omit<SalaLibraryGridProps, 'toastLabels'>) {
  const t = useTranslations('library')
  const tType = useTranslations('discoverFilters.typeBadge')
  const tProgress = useTranslations('progress')
  const progressLabel = useProgressLabel()
  const locale = useLocale()
  const listRef = useRef<HTMLUListElement | HTMLOListElement>(null)
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

  return (
    <div data-sala-library-grid="" className="font-sala-text text-sala-ink">
      <SalaWorkList
        ref={listRef}
        aria-label={t('gridLabel')}
        // La rejilla llega hecha del servidor: no carga nunca y no anuncia nada.
        loadingLabel=""
        // Destino del foco al cerrar el diálogo si la tarjeta ya no está.
        tabIndex={-1}
        className={`${REJILLA} focus:outline-none sala-focused:sala-focus`}
      >
        {entries.map((entry, i) => {
          const { type, externalId } = parseMediaId(entry.mediaId)
          const title = entry.title ?? entry.mediaId
          const rating = entryRating10(entry)
          // Solo en curso y con dato: «Sin empezar» no aporta en la tarjeta.
          const progress =
            entry.status === 'in_progress' && progressKindFor(type) && hasProgress(entry.progress)
              ? progressLabel(type, entry.progress)
              : null
          return (
            <SalaWorkCard
              key={entry.mediaId}
              href={`/media/${type}/${externalId}`}
              title={title}
              format={type}
              formatLabel={tType(type)}
              year={entry.year}
              poster={entry.poster ?? null}
              ratio="2/3"
              sizes={SIZES}
              priority={i < PRIORITY_CARDS}
              headingLevel={2}
              detail={
                <span className="flex flex-col">
                  <span data-sala-library-status="">{t(`status.${entry.status}`)}</span>
                  {progress ? (
                    <span data-sala-library-progress="" className="tabular-nums">
                      <span className="sr-only">{tProgress('title')}: </span>
                      {progress}
                    </span>
                  ) : null}
                  {rating !== null ? (
                    <span>
                      {t('cardScore', {
                        scale,
                        value: number.format(scale === 'ten' ? rating : Math.round(rating) / 2),
                      })}
                    </span>
                  ) : null}
                </span>
              }
              action={
                <SalaLibraryQuickEdit entry={entry} title={title} onSaved={onSaved} fallbackFocusRef={listRef} />
              }
            />
          )
        })}
      </SalaWorkList>
    </div>
  )
}
