'use client'

// ============================================================
// KULTURA — SalaLibraryView (fase 8.5 B2, bandera SALA_BIBLIOTECA)
// La Biblioteca entera en «Sala»: cabecera, selector Títulos/Diario,
// contadores que filtran por estado, filtros y orden, y la rejilla de B1.
//
// Solo se carga con `next/dynamic` (`SalaLibraryViewLazy`): con la bandera
// apagada la biblioteca no descarga su código ni sus hojas.
//
// El estado de los filtros sigue en la URL (`type`, `status`, `score`,
// `fav`, `view`) y lo lleva `LibraryClient`, igual que hoy; B2 añade `sort`.
// Este componente solo pinta y avisa (`onFilter`).
//
// - Contadores = filtro de estado: cuatro botones con `aria-pressed` que
//   cuentan la biblioteca ENTERA (son el resumen) y filtran al pulsarlos;
//   otra vez, quitan el filtro. Sustituyen a la fila de chips de estado.
// - «Filtros» abre un panel (`aria-expanded`): el formato con botones con
//   `aria-pressed` que se parten en varias líneas (sin scroll horizontal), la
//   nota mínima en un `<select>` nativo y «Solo favoritos» en un interruptor
//   (`SalaSwitch`, `role="switch"`). Todo filtra al momento, como hoy.
// - «Ordenar por»: un `<select>` nativo (`SalaSelect`).
// - El número de títulos es una región `status`: al filtrar se anuncia el
//   resultado («3 títulos»).
// ============================================================

// Las hojas de «Sala» (tokens, fuentes y rótulo) llegan con `SalaLibraryGrid`,
// que este módulo importa siempre: van en el mismo trozo de `next/dynamic`.

import { useId, useMemo, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaSelect } from '@/components/sala/SalaSelect'
import { SalaSwitch } from '@/components/sala/SalaSwitch'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaLibraryGrid, type SalaLibraryGridProps } from '@/components/library/sala/SalaLibraryGrid'
import { LIBRARY_SORTS, parseLibrarySort, sortLibrary } from '@/lib/library/sort'
import type { LibraryStatus } from '@/types/library'

export type LibraryView = 'collection' | 'diary'

export interface SalaLibraryFilters {
  type: string
  status: string
  score: string
  favorites: boolean
  sort: string
}

export interface SalaLibraryViewProps extends SalaLibraryGridProps {
  view: LibraryView
  /** Enlaces de Títulos y Diario. `null`: sin diario (ni selector ni favoritos). */
  viewHrefs: Record<LibraryView, string> | null
  /** El diario, ya montado, cuando `view` es `diary`. */
  diary?: ReactNode
  /** Títulos de la biblioteca entera (sin filtrar). */
  totalCount: number
  /** Títulos por estado, de la biblioteca entera. */
  counts: Partial<Record<LibraryStatus, number>>
  filters: SalaLibraryFilters
  /** Cambia uno o varios parámetros de la URL (`'all'` lo quita). */
  onFilter: (next: Record<string, string>) => void
}

const COUNTERS = [
  { status: 'completed', labelKey: 'completed' },
  { status: 'in_progress', labelKey: 'inProgress' },
  { status: 'pending', labelKey: 'pending' },
  { status: 'abandoned', labelKey: 'dropped' },
] as const

const TYPES = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'] as const
const SCORES = ['5', '4', '3', '2'] as const

const FOCO = 'sala-focused:sala-focus'

/** Marca de «elegido»: lo dice la forma, no solo el color (y `aria-pressed`). */
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="h-4 w-4 shrink-0">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  )
}

/** Tres reguladores: el icono de «Filtros», de trazo recto. */
function FiltersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M3 5h14M3 10h14M3 15h14" />
      <path d="M7 3v4M13 8v4M9 13v4" />
    </svg>
  )
}

/** Un filtro que se enciende o se apaga: `SalaButton` con `aria-pressed`. */
function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <SalaButton
      variant={pressed ? 'primary' : 'secondary'}
      aria-pressed={pressed}
      onClick={onClick}
      icon={pressed ? <CheckIcon /> : undefined}
      className="px-4"
    >
      {children}
    </SalaButton>
  )
}

export function SalaLibraryView(props: SalaLibraryViewProps) {
  const { view, viewHrefs, diary, totalCount, entries } = props
  const t = useTranslations('library')
  const td = useTranslations('diary')

  const header = (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="sala-type-heading [overflow-wrap:anywhere]">{t('title')}</h1>
        {view === 'collection' && totalCount > 0 ? (
          // Región viva: al filtrar se anuncia cuántos quedan.
          <p role="status" data-sala-library-count="" className="text-sala-ink-secondary sala-type-label tabular-nums">
            {t('items', { count: entries.length })}
          </p>
        ) : null}
      </div>
      {viewHrefs ? (
        <nav aria-label={td('view')}>
          <ul className="flex border-2 border-sala-ink">
            {(['collection', 'diary'] as const).map((v) => (
              <li key={v}>
                <Link
                  href={viewHrefs[v]}
                  scroll={false}
                  aria-current={view === v ? 'page' : undefined}
                  className={cn(
                    'flex min-h-sala-target items-center px-5 no-underline sala-type-label',
                    'transition-colors duration-sala-fast ease-sala motion-reduce:transition-none',
                    FOCO,
                    view === v
                      ? 'bg-sala-ink text-sala-background'
                      : 'text-sala-ink sala-hover:bg-sala-panel'
                  )}
                >
                  {v === 'collection' ? td('viewCollection') : td('viewDiary')}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  )

  return (
    <div data-sala-library="" className="font-sala-text text-sala-ink">
      {header}
      {view === 'diary' ? diary : totalCount === 0 ? <EmptyLibrary /> : <Collection {...props} />}
    </div>
  )
}

function EmptyLibrary() {
  const t = useTranslations('library')
  return (
    <SalaBlockState
      title={t('empty.title')}
      description={t('empty.hint')}
      action={
        <SalaButton asChild>
          <Link href="/discover">{t('empty.cta')}</Link>
        </SalaButton>
      }
    />
  )
}

function Collection({ entries, scale, onSaved, toastLabels, counts, filters, onFilter, viewHrefs }: SalaLibraryViewProps) {
  const t = useTranslations('library')
  const tS = useTranslations('library.sala')
  const tF = useTranslations('filters')
  const locale = useLocale()
  const panelId = useId()
  const typeId = useId()
  const [open, setOpen] = useState(false)

  const sort = parseLibrarySort(filters.sort)
  const sorted = useMemo(() => sortLibrary(entries, sort, locale), [entries, sort, locale])

  const panelActive = (filters.type !== 'all' ? 1 : 0) + (filters.score !== 'all' ? 1 : 0) + (filters.favorites ? 1 : 0)
  const anyActive = panelActive > 0 || filters.status !== 'all'
  // Quita los filtros y deja el orden y la vista.
  const reset = () => onFilter({ type: 'all', status: 'all', score: 'all', fav: 'all' })

  return (
    <>
      {/* Contadores: el resumen de toda la biblioteca y, al pulsarlos, el filtro de estado. */}
      <div role="group" aria-label={tS('statusFilter')} className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COUNTERS.map((c) => {
          const pressed = filters.status === c.status
          return (
            <button
              key={c.status}
              type="button"
              aria-pressed={pressed}
              onClick={() => onFilter({ status: pressed ? 'all' : c.status })}
              className={cn(
                'flex min-h-sala-target min-w-0 cursor-pointer flex-col items-start gap-1 border-2 px-4 py-3 text-left',
                'touch-manipulation [-webkit-tap-highlight-color:transparent]',
                'transition-colors duration-sala-fast ease-sala motion-reduce:transition-none',
                FOCO,
                pressed
                  ? 'border-sala-ink bg-sala-ink text-sala-background'
                  : 'border-transparent bg-sala-panel text-sala-ink sala-hover:border-sala-ink'
              )}
            >
              <span className="sala-type-data tabular-nums">{counts[c.status] ?? 0}</span>
              {/* El espacio separa cifra y nombre en el nombre accesible («3 Completados»). */}{' '}
              <span className="flex min-w-0 items-center gap-1 sala-type-small [overflow-wrap:anywhere]">
                {pressed ? <CheckIcon /> : null}
                {t(`counters.${c.labelKey}`)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Barra: abrir los filtros, quitarlos y el orden. */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SalaButton
          variant="secondary"
          icon={<FiltersIcon />}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          {panelActive > 0 ? tS('filtersActive', { count: panelActive }) : tF('filters')}
        </SalaButton>
        {anyActive ? (
          <SalaButton variant="quiet" onClick={reset}>
            {tF('reset')}
          </SalaButton>
        ) : null}
        <SalaSelect
          label={tS('sortLabel')}
          value={sort}
          onChange={(e) => onFilter({ sort: e.target.value })}
          fieldClassName="w-full sm:ml-auto sm:w-72"
        >
          {LIBRARY_SORTS.map((s) => (
            <option key={s} value={s}>
              {tS(`sort.${s}`)}
            </option>
          ))}
        </SalaSelect>
      </div>

      <div
        id={panelId}
        hidden={!open}
        data-sala-library-filters=""
        // `grid` pisaría al `hidden` del navegador: la clase solo va abierto.
        className={cn('mb-8 gap-6 bg-sala-panel p-4 motion-safe:animate-sala-rise-in sm:p-6', open ? 'grid' : 'hidden')}
      >
        <div role="group" aria-labelledby={typeId}>
          <p id={typeId} className="mb-2 sala-type-label">
            {tF('type')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Toggle pressed={filters.type === 'all'} onClick={() => onFilter({ type: 'all' })}>
              {tF('all')}
            </Toggle>
            {TYPES.map((type) => (
              <Toggle
                key={type}
                pressed={filters.type === type}
                onClick={() => onFilter({ type: filters.type === type ? 'all' : type })}
              >
                {tF(type)}
              </Toggle>
            ))}
          </div>
        </div>

        {/* Nota mínima y favoritos (Víctor, #292): un desplegable y un interruptor, en una fila. */}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <SalaSelect
            label={tS('scoreLabel')}
            value={filters.score}
            onChange={(e) => onFilter({ score: e.target.value })}
            fieldClassName="w-full sm:w-72"
          >
            <option value="all">{tS('scoreAny')}</option>
            {SCORES.map((score) => (
              <option key={score} value={score}>
                {score === '5' ? tS('scoreTop') : tS('scoreMin', { stars: Number(score) })}
              </option>
            ))}
          </SalaSelect>
          {/* Favoritos (F-24): solo con el diario. Vale al momento: un interruptor. */}
          {viewHrefs ? (
            <SalaSwitch
              label={tS('favoritesOnly')}
              checked={filters.favorites}
              onChange={(e) => onFilter({ fav: e.target.checked ? '1' : 'all' })}
              fieldClassName="w-full sm:w-auto"
            />
          ) : null}
        </div>
      </div>

      {sorted.length === 0 ? (
        <SalaBlockState
          title={t('empty.filtered')}
          description={t('empty.filteredHint')}
          action={
            <SalaButton variant="secondary" onClick={reset}>
              {tF('reset')}
            </SalaButton>
          }
        />
      ) : (
        <SalaLibraryGrid entries={sorted} scale={scale} onSaved={onSaved} toastLabels={toastLabels} />
      )}
    </>
  )
}
