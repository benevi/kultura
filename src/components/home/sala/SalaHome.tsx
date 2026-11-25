'use client'

// ============================================================
// KULTURA — Inicio en «Sala» (fase 8.5 I1, bandera SALA_INICIO)
// El título de la página y las filas de obras de Inicio con `SalaWorkList` y
// `SalaWorkCard`: «Continúa donde lo dejaste», «Popular entre tus amigos» y
// las novedades por género. El hero «Continuando», «Esta noche», «Para ti» y
// la actividad de amigos siguen como hoy (I2).
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
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'
import '@/styles/sala/title.css'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/api/client'
import { cn } from '@/lib/utils/index'
import { Link } from '@/i18n/navigation'
import { SalaWorkList } from '@/components/sala/SalaWorkList'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { ContinueProgress, canQuickAdvance } from '@/components/home/ContinueProgress'
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

/** `movie_603` → `/media/movie/603`. */
function hrefOf(type: string, mediaId: string): string {
  return `/media/${type}/${mediaId.split('_').slice(1).join('_')}`
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
}

/** Una sección de Inicio: su `h2` y la fila de obras, nombrada por él. */
function Row({ title, name, loading = false, count, children, after }: RowProps) {
  const t = useTranslations('home.sala')
  const id = useId()
  return (
    <section aria-labelledby={id} data-sala-home-row={name} className="font-sala-text text-sala-ink">
      <h2 id={id} className="mb-3 sala-type-data [overflow-wrap:anywhere]">
        {title}
      </h2>
      {/* Montada siempre mientras haya algo que enseñar: así anuncia la carga una vez. */}
      <SalaWorkList
        aria-labelledby={id}
        loading={loading}
        loadingLabel={t('loading', { title })}
        loadedLabel={t('results', { count })}
        skeletons={SKELETONS}
        itemClassName={TARJETA}
        className={loading || count > 0 ? cn(FILA) : 'hidden'}
      >
        {children}
      </SalaWorkList>
      {after}
    </section>
  )
}

/**
 * «Continúa donde lo dejaste»: lo que está en curso y lo pendiente, con su
 * progreso y «+1» (el mismo `ContinueProgress` de hoy, fuera del enlace de la
 * tarjeta y después de él en el orden del teclado).
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
          {canQuickAdvance(item.type) ? (
            <ContinueProgress
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

/** Pide una ruta de Inicio al montarse (las mismas que hoy) y la cancela al salir. */
function useHomeFetch<T>(url: string, isEmpty: (data: T) => boolean): { data: T | null; status: Status } {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<Status>('loading')
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
  }, [url])
  return { data, status }
}

/** «Popular entre tus amigos» (`/api/popular-in-circle`, como `PopularInCircle`). */
export function SalaHomeCircle() {
  const t = useTranslations('home')
  const tType = useTranslations('discoverFilters.typeBadge')
  const { data, status } = useHomeFetch<CircleMediaItem[]>('/api/popular-in-circle', (list) => list.length === 0)
  // Como hoy: si falla, la sección no sale (I2 decide si avisa).
  if (status === 'error') return null
  const items = data ?? []
  return (
    <Row
      title={t('popularInCircle')}
      name="circle"
      loading={status === 'loading'}
      count={items.length}
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
 * montada desde la carga (con el título «Tendencias») para que anuncie el final.
 */
export function SalaHomeNews() {
  const t = useTranslations('home')
  const tType = useTranslations('discoverFilters.typeBadge')
  const { data, status } = useHomeFetch<GenreNewsData>('/api/genre-news', (d) => d.movies.length === 0 && d.tv.length === 0)
  if (status === 'error' || status === 'empty') return null

  const rows: { title: string; items: MediaItem[] }[] = []
  if (!data) {
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
        <Row key={r} title={row.title} name={`news-${r}`} loading={status === 'loading'} count={row.items.length}>
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
