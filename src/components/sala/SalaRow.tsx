'use client'

// ============================================================
// KULTURA — Una fila de obras en «Sala» (fase 8.5 I1, I2a e I2b; P1)
// Su `h2`, las flechas «anteriores / siguientes» desde `md`, la lista de obras
// nombrada por el `h2` y el hueco del aviso de error con «Reintentar». Nació en
// Inicio («Continúa», «Popular entre tus amigos», las novedades y «Esta
// noche», con su explicación debajo del `h2`, «Sorpréndeme» junto a las
// flechas y la elegida encima de la fila). Desde Perfil P1 vive aquí y la
// usan también las filas del perfil («Viendo ahora», «Últimos completados»).
// ============================================================

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/index'
import { SalaWorkList } from '@/components/sala/SalaWorkList'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaNotice } from '@/components/sala/SalaNotice'

/**
 * La fila: se desliza en horizontal dentro de su caja (la página no). El
 * relleno de 8 px deja sitio al anillo de foco de la tarjeta (3 px a 3 px de
 * ella), que de otro modo cortaría la caja con scroll; el margen negativo
 * devuelve las tarjetas a la línea del texto. Sin `scroll-behavior: smooth`:
 * con movimiento reducido no hay nada que apagar.
 */
const FILA =
  '-mx-2 flex gap-4 overflow-x-auto px-2 pb-3 pt-2 snap-x snap-proximity scroll-px-2 [scrollbar-width:thin] [scrollbar-color:var(--sala-border)_transparent]'
/** Ancho de cada tarjeta: el de las filas de hoy, algo más en pantallas anchas. */
export const TARJETA = 'w-36 shrink-0 snap-start sm:w-40'
export const ROW_CARD_SIZES = '(min-width: 640px) 160px, 144px'
/** Esqueletos mientras llega una fila. */
const SKELETONS = 6

interface RowProps {
  title: string
  /** Para los tests y las capturas. */
  name: string
  loading?: boolean
  count: number
  children?: ReactNode
  /** Una línea debajo del `h2` (qué es la fila). */
  description?: ReactNode
  /** Un botón junto a las flechas (y en el móvil, debajo del encabezado). */
  action?: ReactNode
  /** Lo que va entre el encabezado y la lista. */
  before?: ReactNode
  /** Lo que va debajo de la lista (un estado vacío). */
  after?: ReactNode
  /** La fila no ha cargado: el aviso con «Reintentar» llama a esto. */
  onRetry?: () => void
  /**
   * Nivel del encabezado: `h2` por defecto; `h3` cuando la fila va dentro de
   * una sección que ya tiene el suyo (las listas públicas de `/u`, P3).
   */
  headingLevel?: 2 | 3
}

/** Flecha de la fila (dibujo; el nombre lo lleva el botón). */
function Arrow({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="h-5 w-5">
      <path d={dir === 'prev' ? 'M12.5 4 6.5 10l6 6' : 'M7.5 4l6 6-6 6'} />
    </svg>
  )
}

/** La flecha: cuadrada, de 48 px, con el borde de tinta del `SalaButton` secundario. */
const FLECHA =
  'inline-flex h-sala-target w-sala-target scroll-mt-24 items-center justify-center border-2 bg-transparent touch-manipulation transition-colors duration-sala-fast ease-sala motion-reduce:transition-none sala-focused:sala-focus'
const FLECHA_ACTIVA =
  'cursor-pointer border-sala-ink text-sala-ink sala-hover:bg-sala-ink sala-hover:text-sala-background sala-pressed:bg-sala-ink sala-pressed:text-sala-background'
/** Como el `SalaButton` deshabilitado: el gris del borde y el trazo discontinuo, que lo dice sin color. */
const FLECHA_PARADA = 'cursor-not-allowed border-dashed border-sala-border text-sala-ink-disabled'

/**
 * Hasta dónde se puede mover la fila. Se mide al deslizarla, al cambiar de
 * tamaño y cuando cambian sus tarjetas (`deps`).
 */
function useRowEdges(listRef: RefObject<HTMLElement | null>, deps: unknown[]) {
  const [edges, setEdges] = useState({ start: true, end: true })
  const measure = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // Un píxel de holgura: con zoom, `scrollLeft` lleva decimales.
    const start = el.scrollLeft <= 1
    const end = el.scrollLeft >= max - 1
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [listRef])
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro?.disconnect()
    }
    // `deps`: lo que cambia el ancho de lo que hay dentro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps])
  return edges
}

/**
 * Una sección con una fila de obras: su `h2`, las flechas (desde `md`), la fila de obras,
 * nombrada por el `h2`, y el hueco del aviso de error, montado siempre para
 * que un lector lo anuncie al entrar.
 */
export function SalaRow({ title, name, loading = false, count, children, description, action, before, after, onRetry, headingLevel = 2 }: RowProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  const t = useTranslations('home.sala')
  const id = useId()
  const listId = `${id}-lista`
  const listRef = useRef<HTMLUListElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const showList = loading || count > 0
  const edges = useRowEdges(listRef, [count, loading])

  function scrollRow(dir: 1 | -1) {
    const el = listRef.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Algo menos que el ancho de la fila: la última tarjeta que se veía sigue a la vista.
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 160), behavior: reduce ? 'auto' : 'smooth' })
  }

  function retry() {
    // «Reintentar» desaparece al pulsarlo: el foco pasa al encabezado de la
    // sección en vez de perderse, y la fila anuncia la carga.
    headingRef.current?.focus()
    onRetry?.()
  }

  const arrow = (dir: 'prev' | 'next') => {
    const stopped = dir === 'prev' ? edges.start : edges.end
    return (
      <button
        type="button"
        aria-controls={listId}
        aria-label={t(dir, { title })}
        aria-disabled={stopped || undefined}
        data-sala-row-arrow={dir}
        onClick={() => {
          if (!stopped) scrollRow(dir === 'prev' ? -1 : 1)
        }}
        className={cn(FLECHA, stopped ? FLECHA_PARADA : FLECHA_ACTIVA)}
      >
        <Arrow dir={dir} />
      </button>
    )
  }

  return (
    <section aria-labelledby={id} data-sala-row={name} className="font-sala-text text-sala-ink">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <Heading id={id} ref={headingRef} tabIndex={-1} className="scroll-mt-24 outline-none sala-type-data [overflow-wrap:anywhere]">
            {title}
          </Heading>
          {description ? <p className="mt-1 text-sala-ink-secondary sala-type-small">{description}</p> : null}
        </div>
        {action || showList ? (
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {showList ? (
              // Si todo cabe, no hay nada que mover: las flechas no se ven ni se
              // alcanzan con Tab, pero guardan su sitio (nada salta al medir).
              <div
                data-sala-row-arrows=""
                className={cn('hidden shrink-0 gap-2 md:flex', edges.start && edges.end && 'invisible')}
              >
                {arrow('prev')}
                {arrow('next')}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {before}
      {/* Montada siempre mientras haya algo que enseñar: así anuncia la carga una vez. */}
      <SalaWorkList
        ref={listRef}
        id={listId}
        aria-labelledby={id}
        loading={loading}
        loadingLabel={t('loading', { title })}
        loadedLabel={t('results', { count })}
        skeletons={SKELETONS}
        itemClassName={TARJETA}
        className={showList ? cn(FILA) : 'hidden'}
      >
        {children}
      </SalaWorkList>
      {/* Montado siempre: un lector anuncia el error al entrar el aviso. */}
      <div role="alert" data-sala-row-error="">
        {onRetry ? (
          <SalaNotice
            tone="error"
            live="off"
            title={t('errorTitle', { title })}
            action={
              <SalaButton variant="secondary" onClick={retry}>
                {t('retry')}
              </SalaButton>
            }
          >
            {t('errorBody')}
          </SalaNotice>
        ) : null}
      </div>
      {after}
    </section>
  )
}
