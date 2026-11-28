'use client'

// ============================================================
// KULTURA — /u/[username]/l/[id] en «Sala» (fase 8.5 L5, bandera SALA_LISTAS)
// La lista pública en lectura: lo que ve quien no es su dueño ni miembro (o
// no tiene cuenta). Todo llega ya traducido del servidor: este trozo no
// necesita más textos que los de `SalaLink` («common»), que ya lleva `/u`.
//
// Lo que arregla respecto a la página de hoy:
// - **Enlace compuesto confuso**: avatar, nombre, número de títulos y «Ver
//   toda la colección» eran un solo enlace a `/u/…`. Ahora los datos van con
//   palabras («películas · ranking personal · 6 títulos») y el dueño aparte,
//   «de @ana», con su propio enlace.
// - **Formatos en mayúsculas** (`FormatLabel`): ahora en minúscula, como el
//   resto de «Sala».
// - **Títulos**: `SalaWorkCard` en una lista ordenada; en un ranking, el
//   puesto a la vista y en el nombre de la tarjeta; la nota del dueño en sus
//   datos.
// - **Denunciar** en la cabecera: con sesión, el botón de siempre con la piel
//   «Sala»; sin ella, el enlace al formulario público.
// - **Una sola llamada a registrarse** y solo sin sesión (con sesión, la
//   barra de la app la pone quien monta la página).
//
// Los miembros de una colaborativa no salen (#322: no se enseñan a quien no
// es miembro). Solo se carga con `next/dynamic` (`SalaPublicListLazy`).
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

import { useId, type ReactNode } from 'react'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaWorkList } from '@/components/sala/SalaWorkList'
import type { MediaType } from '@/types/media'

/** Cuántas portadas de la primera fila cargan con prioridad (REN-6). */
const PRIORITY_POSTERS = 4

const REJILLA = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

export interface SalaPublicListEntry {
  mediaId: string
  href: string
  title: string
  format: MediaType
  /** El formato con palabras, ya traducido. */
  formatLabel: string
  year?: number
  poster?: string | null
  /** La nota del dueño para este título. */
  note: string | null
}

export interface SalaPublicListProps {
  name: string
  /** Datos de la lista con palabras y en minúscula: formato, plantilla y número de títulos. */
  facts: string[]
  owner: {
    username: string
    avatarColor: string
    avatarInitials: string
    avatarIcon: string | null
    /** «de @ana». */
    label: string
    href: string
  }
  description: string | null
  ranked: boolean
  entries: SalaPublicListEntry[]
  labels: {
    items: string
    empty: string
    loading: string
  }
  /** La denuncia: el botón con sesión o el enlace al formulario público. */
  report: ReactNode
  /** Sin sesión: la única llamada a registrarse. */
  cta: { title: string; text: string; button: string; href: string } | null
}

export function SalaPublicList({ name, facts, owner, description, ranked, entries, labels, report, cta }: SalaPublicListProps) {
  const itemsHeadingId = useId()
  const ctaTitleId = useId()

  return (
    <main
      id="main"
      data-sala-public-list=""
      className="page-grid [&>*]:max-w-6xl flex-1 py-6 md:py-8 flex flex-col gap-10 font-sala-text text-sala-ink"
    >
      <header className="flex flex-col gap-4">
        <h1 className="sala-type-heading [overflow-wrap:anywhere]">{name}</h1>
        <p data-sala-public-list-facts="" className="sala-type-small text-sala-ink-secondary [overflow-wrap:anywhere]">
          {facts.map((fact, i) => (
            <span key={fact} className={i === 0 ? 'font-semibold text-sala-ink' : undefined}>
              {i > 0 ? <Sep /> : null}
              {fact}
            </span>
          ))}
        </p>
        <p data-sala-public-list-owner="" className="flex items-center gap-3 sala-type-small">
          {/* Decorativo: el nombre ya va en el enlace. */}
          <span aria-hidden="true" className="shrink-0">
            <Avatar
              initials={owner.avatarInitials}
              color={owner.avatarColor}
              icon={owner.avatarIcon}
              size="sm"
              className="rounded-none"
            />
          </span>
          <Link
            href={owner.href}
            className="inline-flex min-h-sala-target items-center text-sala-ink underline underline-offset-2 [overflow-wrap:anywhere] sala-focused:sala-focus"
          >
            {owner.label}
          </Link>
        </p>
        {description ? (
          <p className="max-w-2xl whitespace-pre-line sala-type-text text-sala-ink [overflow-wrap:anywhere]">{description}</p>
        ) : null}
        <div data-sala-public-list-report="">{report}</div>
      </header>

      <section aria-labelledby={itemsHeadingId} className="flex flex-col gap-4">
        <h2 id={itemsHeadingId} className="sala-type-data">
          {labels.items}
        </h2>
        {entries.length === 0 ? (
          <SalaBlockState headingLevel={3} title={labels.empty} />
        ) : (
          <SalaWorkList ordered aria-labelledby={itemsHeadingId} loadingLabel={labels.loading} className={REJILLA}>
            {entries.map((entry, index) => (
              <SalaWorkCard
                key={entry.mediaId}
                href={entry.href}
                title={entry.title}
                rank={ranked ? index + 1 : undefined}
                format={entry.format}
                formatLabel={entry.formatLabel}
                year={entry.year}
                poster={entry.poster}
                ratio="2/3"
                headingLevel={3}
                priority={index < PRIORITY_POSTERS}
                detail={entry.note ? <span className="[overflow-wrap:anywhere]">{entry.note}</span> : undefined}
                className="w-full"
              />
            ))}
          </SalaWorkList>
        )}
      </section>

      {cta ? (
        <section
          aria-labelledby={ctaTitleId}
          data-sala-public-list-cta=""
          className="flex flex-col gap-4 bg-sala-panel p-4 sm:p-6 md:flex-row md:items-center md:justify-between md:gap-8"
        >
          <div className="min-w-0 max-w-prose">
            <h2 id={ctaTitleId} className="sala-type-data">
              {cta.title}
            </h2>
            <p className="mt-2 text-sala-ink-secondary sala-type-text">{cta.text}</p>
          </div>
          <SalaButton asChild className="shrink-0 self-start md:self-auto">
            <Link href={cta.href}>{cta.button}</Link>
          </SalaButton>
        </section>
      ) : null}
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
