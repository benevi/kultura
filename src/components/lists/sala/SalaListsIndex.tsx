'use client'

// ============================================================
// KULTURA — /lists en «Sala» (fase 8.5 L1, bandera SALA_LISTAS)
// El índice de listas: cabecera con «Nueva lista», una tarjeta por lista y el
// vacío.
//
// - Cada tarjeta: mosaico de las cuatro primeras portadas (en el orden de la
//   lista; las casillas que faltan, en el color del panel) y el nombre, que es
//   el único enlace (cubre la tarjeta con `::after`, como `SalaWorkCard`).
//   Debajo, con palabras y en minúscula («película · 6 títulos · privada») y,
//   si es colaborativa, tiene plantilla o no es tuya, otra línea con eso.
// - Los nombres son `h2` bajo el `h1` de la página (hoy son `h3` sin `h2`).
// - El vacío es un `SalaBlockState` con «Nueva lista».
// - «Nueva lista» abre «Crear lista» en «Sala» (`SalaCreateListDialog`, L2),
//   que se descarga al pulsar.
//
// Solo se carga con `next/dynamic` (`SalaListsIndexLazy`): con la bandera
// apagada el índice no descarga su código ni sus hojas.
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils/index'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaPoster } from '@/components/sala/SalaPoster'
import type { List, ListCover } from '@/types/list'

// L2: «Crear lista» en «Sala», que solo se descarga al pulsar «Nueva lista».
const SalaCreateListDialog = dynamic(
  () => import('./SalaCreateListDialog').then((m) => m.SalaCreateListDialog),
  { ssr: false }
)

/** Casillas del mosaico. */
const MOSAICO = 4

/** Rejilla de tarjetas: dos columnas a 320 px, como las de obras. */
export const SALA_LISTS_GRID = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'

/** El enlace del nombre: cubre la tarjeta y lleva el anillo de foco, como en `SalaWorkCard`. */
const ENLACE = cn(
  'text-sala-ink no-underline [-webkit-tap-highlight-color:transparent]',
  "after:absolute after:inset-0 after:content-['']",
  'sala-focused:[outline:none] sala-focused:after:sala-focus',
  '[&>span]:sala-hover:bg-sala-ink [&>span]:sala-hover:text-sala-background',
  '[&>span]:sala-pressed:bg-sala-ink-secondary [&>span]:sala-pressed:text-sala-background',
  'forced-colors:[&>span]:sala-hover:underline forced-colors:[&>span]:sala-pressed:underline'
)

const MARCA = cn(
  'px-0.5 font-sala-text [box-decoration-break:clone] [-webkit-box-decoration-break:clone] [overflow-wrap:anywhere]',
  'transition-colors duration-sala-fast ease-sala motion-reduce:transition-none'
)

export interface SalaListsIndexProps {
  lists: List[]
  /** Quien mira: sus listas no dicen «De @…». */
  viewerId: string
}

export function SalaListsIndex({ lists, viewerId }: SalaListsIndexProps) {
  const t = useTranslations('lists')
  const [creating, setCreating] = useState(false)

  const nueva = (
    <SalaButton variant="primary" onClick={() => setCreating(true)}>
      {t('newList')}
    </SalaButton>
  )

  return (
    <main data-sala-lists="" className="page-grid [&>*]:max-w-6xl py-6 md:py-8 font-sala-text text-sala-ink">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <h1 className="sala-type-heading [overflow-wrap:anywhere]">{t('title')}</h1>
        {lists.length > 0 ? nueva : null}
      </header>

      {lists.length === 0 ? (
        <SalaBlockState title={t('noLists')} description={t('noListsHint')} action={nueva} />
      ) : (
        <ul className={SALA_LISTS_GRID}>
          {lists.map((list, i) => (
            <SalaListCard key={list.id} list={list} viewerId={viewerId} priority={i < 4} />
          ))}
        </ul>
      )}

      {creating ? <SalaCreateListDialog onClose={() => setCreating(false)} /> : null}
    </main>
  )
}

/** Separador de datos: un punto a la vista y una coma para el lector de pantalla. */
function Sep() {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
    </>
  )
}

/** El mosaico: las portadas que haya y, en el resto de casillas, el panel. Es adorno. */
function SalaListMosaic({ covers, priority }: { covers: ListCover[]; priority: boolean }) {
  const casillas = Array.from({ length: MOSAICO }, (_, i) => covers[i] ?? null)
  return (
    <div aria-hidden="true" data-sala-list-mosaic="" className="grid grid-cols-2 gap-0.5 bg-sala-background">
      {casillas.map((cover, i) =>
        cover ? (
          <SalaPoster
            key={i}
            src={cover.poster}
            alt=""
            title={cover.title}
            ratio="2/3"
            sizes="(max-width: 640px) 22vw, (max-width: 1024px) 15vw, 10vw"
            fallback="plain"
            priority={priority && i === 0}
          />
        ) : (
          <div key={i} className="aspect-[2/3] bg-sala-panel forced-colors:border forced-colors:border-[GrayText]" />
        )
      )}
    </div>
  )
}

export function SalaListCard({ list, viewerId, priority = false }: { list: List; viewerId: string; priority?: boolean }) {
  const t = useTranslations('lists')
  const tType = useTranslations('discoverFilters.typeBadge')

  const locale = useLocale()
  // En minúscula, como los formatos de los números de `/u` (pantalla 5).
  const min = (s: string) => s.toLocaleLowerCase(locale)

  const formato = min(list.mediaType === 'mixed' ? t('mediaTypeMixed') : tType(list.mediaType))
  const datos = [
    t('itemCount', { count: list.itemCount ?? 0 }),
    min(list.isPublic ? t('visibilityPublic') : t('visibilityPrivate')),
  ]
  const extra = [
    list.isCollaborative ? t('sala.collaborative') : null,
    list.template ? min(t(`template.${list.template}`)) : null,
    list.owner && list.owner.id !== viewerId ? t('sala.by', { username: list.owner.username }) : null,
  ].filter((x): x is string => Boolean(x))

  return (
    <li data-sala-card="list" className="relative flex min-w-0 flex-col gap-2">
      <SalaListMosaic covers={list.covers ?? []} priority={priority} />
      <h2 className="-ml-0.5 pr-1 line-clamp-3 sala-type-label">
        <Link href={`/lists/${list.id}`} className={ENLACE}>
          <span className={MARCA}>{list.name}</span>
        </Link>
      </h2>
      <p className="sala-type-small [overflow-wrap:anywhere]">
        <span className="font-semibold text-sala-ink">{formato}</span>
        {datos.map((d) => (
          <span key={d} className="text-sala-ink-secondary">
            <Sep />
            {d}
          </span>
        ))}
      </p>
      {extra.length > 0 ? (
        <p className="text-sala-ink-secondary sala-type-small [overflow-wrap:anywhere]">
          {extra.map((d, i) => (
            <span key={d}>
              {i > 0 ? <Sep /> : null}
              {d}
            </span>
          ))}
        </p>
      ) : null}
    </li>
  )
}
