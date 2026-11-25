'use client'

// ============================================================
// KULTURA — Inicio en «Sala» (fase 8.5 I1 e I2a, bandera SALA_INICIO)
// El título de la página, el hero «Continuando» (`SalaHomeHero`) y las filas
// de obras de Inicio con `SalaWorkList` y `SalaWorkCard`: «Continúa donde lo
// dejaste», «Popular entre tus amigos» y las novedades por género. «Esta
// noche», «Para ti» y la actividad de amigos siguen como hoy (I2b).
//
// Solo se carga con `next/dynamic` (`SalaHomeLazy`): con la bandera apagada
// Inicio no descarga este código ni sus hojas.
//
// Usa solo los datos que ya carga Inicio: las filas de `user_media` que lee
// la página y las mismas dos rutas que piden hoy `PopularInCircle` y
// `GenreNews` (`/api/popular-in-circle`, `/api/genre-news`).
//
// Lo que arregla respecto a Inicio de hoy:
// - **Un `h1`.** Inicio no tenía ninguno (el hero empieza en `h2`).
// - **Filas con nombre.** Cada fila es una lista nombrada por su encabezado
//   (`aria-labelledby`); antes, secciones sin nombre y un `div` de enlaces.
// - **Imagen rota.** Las obras sin portada ya no se esconden (E-SIN-CARDS-VACIAS
//   en las filas de amigos y novedades): `SalaPoster` pone el campo de color
//   con el título si no hay portada o si falla.
// - **Fila que se mueve con el ratón.** La barra de scroll de la fila se ve
//   (antes `scrollbar-hide`: sin rueda horizontal no había forma de llegar al
//   final). Con el teclado, cada tarjeta es una parada y la fila la sigue; el
//   anillo de foco cabe dentro de la fila (no se corta).
// - **Carga anunciada una vez** por fila (`SalaWorkList`), con esqueletos
//   quietos con movimiento reducido.
//
// I2a:
// - **Flechas en escritorio.** «Anteriores» y «Siguientes» (48 px) mueven la
//   fila una pantalla. Dicen qué mueven (`aria-controls`) y en los extremos
//   quedan desactivadas con `aria-disabled`, no con `disabled`: así el foco no
//   se pierde cuando la flecha que se pulsa llega al final. Pulsarlas no mueve
//   el foco a la fila. En el móvil, la fila se desliza con el dedo.
// - **Si una fila falla, se dice** (`role="alert"`) con «Reintentar», como en
//   Descubrir; antes la sección desaparecía sin más.
// - **«N amigos»** en la línea de datos de «Popular entre tus amigos».
// - **El «+1» con `SalaButton`** y el aviso de terminar en un diálogo de
//   «Sala», con Cancelar primero (`SalaHomeProgress`).
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'
import '@/styles/sala/title.css'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/api/client'
import { cn } from '@/lib/utils/index'
import { Link } from '@/i18n/navigation'
import { SalaWorkList } from '@/components/sala/SalaWorkList'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaNotice } from '@/components/sala/SalaNotice'
import { progressKindFor } from '@/lib/library/progress'
import { SalaHomeProgress } from './SalaHomeProgress'
import type { ContinueRowItem } from '@/components/home/ContinueRow'
import type { CircleMediaItem } from '@/lib/social/circle'
import type { MediaItem, MediaType } from '@/types/media'

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
const TARJETA = 'w-36 shrink-0 snap-start sm:w-40'
const SIZES = '(min-width: 640px) 160px, 144px'
/** Tarjetas de novedades por fila (como hoy). */
const NEWS_PER_ROW = 8
/** Esqueletos mientras llega una fila. */
const SKELETONS = 6

export { SalaHomeHero } from './SalaHomeHero'

/** `movie_603` → `/media/movie/603`. */
function hrefOf(type: string, mediaId: string): string {
  return `/media/${type}/${mediaId.split('_').slice(1).join('_')}`
}

/**
 * El aviso de borrado programado (ROJO-7), arriba de todo, en «Sala» (I2b).
 * Los textos llegan ya traducidos y con la fecha puesta (los da la página,
 * como hoy). Un aviso (`warning`, con su dibujo y su borde: no solo color)
 * que se anuncia como hoy (`role="status"`, solo el texto) y la salida a
 * Ajustes como botón de 48 px.
 */
export function SalaHomeDeletion({ message, cta }: { message: string; cta: string }) {
  return (
    <SalaNotice tone="warning" data-sala-home-deletion="" className="font-sala-text" action={
      <SalaButton asChild variant="secondary">
        <Link href="/settings">{cta}</Link>
      </SalaButton>
    }>
      {message}
    </SalaNotice>
  )
}

/** El título de la página: Inicio no tenía `h1`. */
export function SalaHomeTitle() {
  const t = useTranslations('home')
  return (
    <h1 data-sala-home-title="" className="font-sala-text text-sala-ink sala-type-heading [overflow-wrap:anywhere]">
      {t('title')}
    </h1>
  )
}

interface RowProps {
  title: string
  /** Para los tests y las capturas. */
  name: string
  loading?: boolean
  count: number
  children?: ReactNode
  /** Lo que va debajo de la lista (un estado vacío). */
  after?: ReactNode
  /** La fila no ha cargado: el aviso con «Reintentar» llama a esto. */
  onRetry?: () => void
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
 * Una sección de Inicio: su `h2`, las flechas (desde `md`), la fila de obras,
 * nombrada por el `h2`, y el hueco del aviso de error, montado siempre para
 * que un lector lo anuncie al entrar.
 */
function Row({ title, name, loading = false, count, children, after, onRetry }: RowProps) {
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
        data-sala-home-arrow={dir}
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
    <section aria-labelledby={id} data-sala-home-row={name} className="font-sala-text text-sala-ink">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 id={id} ref={headingRef} tabIndex={-1} className="scroll-mt-24 outline-none sala-type-data [overflow-wrap:anywhere]">
          {title}
        </h2>
        {showList ? (
          // Si todo cabe, no hay nada que mover: las flechas no se ven ni se
          // alcanzan con Tab, pero guardan su sitio (nada salta al medir).
          <div
            data-sala-home-arrows=""
            className={cn('hidden shrink-0 gap-2 md:flex', edges.start && edges.end && 'invisible')}
          >
            {arrow('prev')}
            {arrow('next')}
          </div>
        ) : null}
      </div>
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
      <div role="alert" data-sala-home-error="">
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

/**
 * «Continúa donde lo dejaste»: lo que está en curso y lo pendiente, con su
 * progreso y «+1» (`SalaHomeProgress`, fuera del enlace de la tarjeta y
 * después de él en el orden del teclado).
 */
export function SalaHomeContinue({ title, items }: { title: string; items: ContinueRowItem[] }) {
  const tType = useTranslations('discoverFilters.typeBadge')
  if (items.length === 0) return null
  return (
    <Row title={title} name="continue" count={items.length}>
      {items.map((item, i) => (
        <div key={item.mediaId} className="flex flex-col">
          <SalaWorkCard
            href={hrefOf(item.type, item.mediaId)}
            title={item.title}
            format={item.type as MediaType}
            formatLabel={tType(item.type)}
            poster={item.poster ?? null}
            ratio="2/3"
            sizes={SIZES}
            priority={i < 4}
            headingLevel={3}
          />
          {progressKindFor(item.type) !== null ? (
            <SalaHomeProgress
              mediaId={item.mediaId}
              mediaType={item.type}
              title={item.title}
              progress={item.progress}
              status={item.status}
              variant="card"
            />
          ) : null}
        </div>
      ))}
    </Row>
  )
}

type Status = 'loading' | 'done' | 'empty' | 'error'

/**
 * Pide una ruta de Inicio al montarse (las mismas que hoy) y la cancela al
 * salir. `retry` la vuelve a pedir tras un error.
 */
function useHomeFetch<T>(url: string, isEmpty: (data: T) => boolean): { data: T | null; status: Status; retry: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiFetch<T>(url, { signal: controller.signal })
      .then((d) => {
        setData(d)
        setStatus(isEmpty(d) ? 'empty' : 'done')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })
    return () => controller.abort()
    // `isEmpty` es una función fija de quien llama: no vuelve a pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt])
  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }, [])
  return { data, status, retry }
}

/** «Popular entre tus amigos» (`/api/popular-in-circle`, como `PopularInCircle`). */
export function SalaHomeCircle() {
  const t = useTranslations('home')
  const tS = useTranslations('home.sala')
  const tType = useTranslations('discoverFilters.typeBadge')
  const { data, status, retry } = useHomeFetch<CircleMediaItem[]>('/api/popular-in-circle', (list) => list.length === 0)
  const items = status === 'error' ? [] : (data ?? [])
  return (
    <Row
      title={t('popularInCircle')}
      name="circle"
      loading={status === 'loading'}
      count={items.length}
      onRetry={status === 'error' ? retry : undefined}
      after={
        status === 'empty' ? (
          <SalaBlockState
            headingLevel={3}
            title={t('noFriends')}
            description={t('noFriendsHint')}
            action={
              <SalaButton asChild variant="secondary">
                <Link href="/friends">{t('addFriends')}</Link>
              </SalaButton>
            }
          />
        ) : null
      }
    >
      {items.map((item) => (
        <SalaWorkCard
          key={item.mediaId}
          href={hrefOf(item.type, item.mediaId)}
          title={item.title}
          format={item.type as MediaType}
          formatLabel={tType(item.type)}
          year={item.year ?? undefined}
          detail={item.friendCount > 0 ? tS('friends', { count: item.friendCount }) : undefined}
          poster={item.poster}
          ratio="2/3"
          sizes={SIZES}
          headingLevel={3}
        />
      ))}
    </Row>
  )
}

interface GenreNewsData {
  movies: MediaItem[]
  tv: MediaItem[]
  genres: string[]
}

/**
 * Novedades (`/api/genre-news`, como `GenreNews`): «Novedades en {género}» y
 * «Series en {género}» o, sin géneros, «Tendencias». La primera fila está
 * montada desde la carga (con el título «Tendencias») para que anuncie el final;
 * si la ruta falla, esa fila dice que no ha cargado y ofrece «Reintentar».
 */
export function SalaHomeNews() {
  const t = useTranslations('home')
  const tType = useTranslations('discoverFilters.typeBadge')
  const { data, status, retry } = useHomeFetch<GenreNewsData>('/api/genre-news', (d) => d.movies.length === 0 && d.tv.length === 0)
  if (status === 'empty') return null

  const rows: { title: string; items: MediaItem[] }[] = []
  // Cargando o con error: la fila de «Tendencias» (la misma que anuncia la carga).
  if (!data || status === 'error') {
    rows.push({ title: t('trends'), items: [] })
  } else {
    const genres = data.genres.slice(0, 3)
    if (genres.length === 0) {
      rows.push({ title: t('trends'), items: [...data.movies, ...data.tv].slice(0, NEWS_PER_ROW) })
    } else {
      const movies = data.movies.slice(0, NEWS_PER_ROW)
      const tv = data.tv.slice(0, NEWS_PER_ROW)
      if (movies.length > 0) rows.push({ title: t('genreNewsTitle', { genre: genres[0] }), items: movies })
      if (tv.length > 0) rows.push({ title: t('genreSeriesTitle', { genre: genres[1] ?? genres[0] }), items: tv })
    }
  }

  return (
    <>
      {rows.map((row, r) => (
        <Row
          key={r}
          title={row.title}
          name={`news-${r}`}
          loading={status === 'loading'}
          count={row.items.length}
          onRetry={status === 'error' ? retry : undefined}
        >
          {row.items.map((item) => (
            <SalaWorkCard
              key={item.id}
              href={`/media/${item.type}/${item.externalId}`}
              title={item.title}
              format={item.type}
              formatLabel={tType(item.type)}
              year={item.year}
              poster={item.poster ?? null}
              ratio="2/3"
              sizes={SIZES}
              headingLevel={3}
            />
          ))}
        </Row>
      ))}
    </>
  )
}
