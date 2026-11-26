'use client'

// ============================================================
// KULTURA — Perfil en «Sala» (fase 8.5 P1, bandera SALA_PERFIL)
// La cabecera de persona, los números en una fila, las filas «Viendo ahora» y
// «Últimos completados» con `SalaRow`/`SalaWorkCard` y los estados de
// biblioteca oculta o vacía con `SalaBlockState`. Las acciones (amistad,
// denunciar), la actividad del amigo y los géneros siguen como hoy (P2).
//
// Solo se carga con `next/dynamic` (`SalaProfileLazy`): con la bandera apagada
// el perfil no descarga este código ni sus hojas.
//
// Lo que arregla respecto al perfil de hoy:
// - **`h1` entero.** El nombre era `truncate`: uno largo se cortaba sin forma
//   de leerlo. Ahora es el rótulo de «Sala» (`SalaTitleText`), que parte línea.
// - **Sin edición de la bio en sitio** (decisión de Víctor del 26-11-2026): su
//   botón era invisible con el teclado (`opacity-0` hasta pasar el ratón) y
//   decía «Añadir bio» aunque ya hubiera una. La bio se edita en Ajustes y el
//   dueño tiene «Editar perfil» (48 px).
// - **Una sola fila de números.** La cabecera y «Estadísticas» repetían casi lo
//   mismo, y con la biblioteca vacía salía además «Sin actividad aún».
// - **Filas con nombre y que se pueden recorrer** (`SalaRow`): antes, una
//   sección sin nombre, un `div` de enlaces y la barra escondida.
// - **Sin «Pendientes»** (decisión del 26-11-2026): decía poco de la persona.
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'
import '@/styles/sala/title.css'

import type { CSSProperties, ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaRow, ROW_CARD_SIZES } from '@/components/sala/SalaRow'
import { SalaTitleText } from '@/components/sala/SalaTitle'
import { getAvatarColor } from '@/lib/constants/avatarColors'
import { readableTextOn } from '@/lib/design/color'
import { cn } from '@/lib/utils/index'
import type { MediaType } from '@/types/media'

/** Tinta oscura y clara para la franja de un color guardado como hex (cuentas antiguas). */
const INK_DARK = 'oklch(16% 0 0)'
const INK_LIGHT = 'oklch(98% 0 0)'

/**
 * El color de la franja: el del avatar, con la tinta que ya cumple 4,5:1 sobre
 * él (`AVATAR_COLORS`, ACC-9). Un hex antiguo lleva la tinta que mejor se lee;
 * sin color reconocible, el panel de «Sala».
 */
export function profileBand(color: string | null | undefined): CSSProperties | null {
  if (!color) return null
  const palette = getAvatarColor(color)
  if (palette) return { backgroundColor: palette.value, color: palette.on }
  const readable = readableTextOn(color)
  if (!readable) return null
  return { backgroundColor: color, color: readable === 'dark' ? INK_DARK : INK_LIGHT }
}

/**
 * Suelo y tope del rótulo del nombre (`--sala-title-floor` y
 * `--sala-title-cap`): nunca por debajo del `h1` de las demás pantallas
 * (`heading`, 30 px) y, en escritorio, como mucho 72 px: un nombre corto
 * llenaría la franja a 150 px y taparía todo lo demás.
 */
const NOMBRE_ROTULO = '[--sala-title-floor:1.875rem] [--sala-title-cap:clamp(1.875rem,6vw,4.5rem)]'

export interface SalaProfileHeaderProps {
  username: string
  avatarColor: string
  avatarInitials: string
  avatarIcon?: string | null
  /** «Miembro desde octubre de 2026», ya compuesto; sin fecha válida, nada. */
  memberSince: string | null
  bio: string | null
  /** Las acciones según quién mira (amistad, denunciar, editar). */
  children?: ReactNode
}

/**
 * La cabecera de persona: una franja con el color de su avatar, el avatar
 * cuadrado y el nombre como rótulo (el `h1` de la página). Debajo, desde
 * cuándo está, su bio y las acciones. Sin imagen de obra no hay sala: la
 * franja es color plano, sin degradado ni sombra (biblia §1 y §4).
 */
export function SalaProfileHeader({ username, avatarColor, avatarInitials, avatarIcon, memberSince, bio, children }: SalaProfileHeaderProps) {
  const band = profileBand(avatarColor)
  return (
    <header data-sala-profile-header="" className="font-sala-text text-sala-ink">
      <div
        data-sala-profile-band=""
        style={band ?? undefined}
        className={cn('flex items-center gap-4 p-4 sm:gap-6 sm:p-6 md:p-8', !band && 'bg-sala-panel text-sala-ink')}
      >
        {/* El avatar va recortado en cuadrado y con un borde de la tinta de la franja: sobre su
            mismo color, el borde es lo que lo separa. Decorativo: el nombre ya está en el h1. */}
        <div aria-hidden="true" className="shrink-0 border-4 border-current">
          <Avatar
            initials={avatarInitials}
            color={avatarColor}
            icon={avatarIcon}
            size="lg"
            className="h-16 w-16 rounded-none text-xl font-extrabold sm:h-20 sm:w-20 sm:text-2xl md:h-24 md:w-24 md:text-3xl"
          />
        </div>
        {/* El h1 es el contenedor del rótulo (`container-type`): de su ancho sale el tamaño. */}
        <h1 className="min-w-0 flex-1 [container-type:inline-size] [overflow-wrap:anywhere]">
          <SalaTitleText title={`@${username}`} className={cn('block hyphens-none', NOMBRE_ROTULO)} />
        </h1>
      </div>
      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0 max-w-prose">
          {memberSince ? <p className="text-sala-ink-secondary sala-type-small">{memberSince}</p> : null}
          {bio ? (
            <p data-sala-profile-bio="" className="mt-2 whitespace-pre-line sala-type-text [overflow-wrap:anywhere]">
              {bio}
            </p>
          ) : null}
        </div>
        {children ? (
          <div data-sala-profile-actions="" className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  )
}

/** «Editar perfil» del dueño: lleva a Ajustes, donde se cambian el nombre, el avatar y la bio. */
export function SalaProfileEdit({ label }: { label: string }) {
  return (
    <SalaButton asChild variant="secondary">
      <Link href="/settings">{label}</Link>
    </SalaButton>
  )
}

export interface SalaProfileNumber {
  value: number
  label: string
}

/**
 * Los números de su biblioteca en una fila: total, completados, en curso y
 * cuántos de cada formato. El formato va escrito, no solo en color.
 */
export function SalaProfileNumbers({ label, items }: { label: string; items: SalaProfileNumber[] }) {
  if (items.length === 0) return null
  return (
    <section aria-label={label} data-sala-profile-numbers="" className="font-sala-text text-sala-ink">
      <ul role="list" className="flex flex-wrap gap-x-8 gap-y-4">
        {items.map((item) => (
          <li key={item.label} className="flex flex-col">
            <span className="tabular-nums sala-type-data">{item.value}</span>
            <span className="text-sala-ink-secondary sala-type-small">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export interface SalaProfileItem {
  mediaId: string
  title: string
  poster: string | null
  type: string
}

/** `movie_603` → `/media/movie/603`. */
function hrefOf(type: string, mediaId: string): string {
  return `/media/${type}/${mediaId.split('_').slice(1).join('_')}`
}

/**
 * Una fila de obras del perfil («Viendo ahora», «Últimos completados»). Las
 * obras sin portada no se esconden: `SalaPoster` pone el campo de color con
 * el título.
 */
export function SalaProfileRow({ title, name, items }: { title: string; name: string; items: SalaProfileItem[] }) {
  const tType = useTranslations('discoverFilters.typeBadge')
  if (items.length === 0) return null
  return (
    <SalaRow title={title} name={name} count={items.length}>
      {items.map((item) => (
        <SalaWorkCard
          key={item.mediaId}
          href={hrefOf(item.type, item.mediaId)}
          title={item.title}
          format={item.type as MediaType}
          formatLabel={tType(item.type)}
          poster={item.poster}
          ratio="2/3"
          sizes={ROW_CARD_SIZES}
          headingLevel={3}
        />
      ))}
    </SalaRow>
  )
}

/** Biblioteca oculta o vacía: qué pasa y, si es la propia, por dónde empezar. */
export function SalaProfileState({ name, title, description, action }: { name: string; title: string; description: string; action?: ReactNode }) {
  return (
    <SalaBlockState
      data-sala-profile-state={name}
      title={title}
      description={description}
      action={action}
      className="font-sala-text"
    />
  )
}
