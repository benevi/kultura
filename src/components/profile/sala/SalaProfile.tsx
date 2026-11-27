'use client'

// ============================================================
// KULTURA — Perfil en «Sala» (fase 8.5 P1, bandera SALA_PERFIL)
// La cabecera de persona, los números en una fila, las filas «Viendo ahora» y
// «Últimos completados» con `SalaRow`/`SalaWorkCard` y los estados de
// biblioteca oculta o vacía con `SalaBlockState`. P2: los géneros favoritos
// con su número a la vista; las acciones sobre otra persona van en
// `SalaProfileSocial` y la actividad del amigo es la vista de Inicio.
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

import { useId, type CSSProperties, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaPoster, SALA_POSTER_RATIO } from '@/components/sala/SalaPoster'
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
  /** Año de la obra (`/u`, P3). */
  year?: number
  /** Una línea más, ya traducida: la nota de su dueño en los favoritos de `/u` (P3). */
  detail?: string
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
export function SalaProfileRow({
  title,
  name,
  items,
  headingLevel = 2,
  description,
  action,
  priorityCount = 0,
}: {
  title: string
  name: string
  items: SalaProfileItem[]
  /** `3` dentro de una sección con su `h2` (las listas públicas de `/u`, P3); las obras bajan uno. */
  headingLevel?: 2 | 3
  /** Una línea debajo del encabezado (el formato de una lista pública). */
  description?: ReactNode
  /** Junto a las flechas: «Ver lista · 6 títulos» en `/u`. */
  action?: ReactNode
  /** Cuántas de las primeras portadas cargan con prioridad (REN-6, `/u`). */
  priorityCount?: number
}) {
  const tType = useTranslations('discoverFilters.typeBadge')
  if (items.length === 0) return null
  return (
    <SalaRow title={title} name={name} count={items.length} headingLevel={headingLevel} description={description} action={action}>
      {items.map((item, i) => (
        <SalaWorkCard
          key={item.mediaId}
          href={hrefOf(item.type, item.mediaId)}
          title={item.title}
          format={item.type as MediaType}
          formatLabel={tType(item.type)}
          poster={item.poster}
          year={item.year}
          detail={item.detail}
          ratio="2/3"
          sizes={ROW_CARD_SIZES}
          priority={i < priorityCount}
          headingLevel={headingLevel === 3 ? 4 : 3}
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

export interface SalaProfileGenre {
  genre: string
  /** «12 títulos», ya traducido. */
  count: string
}

/**
 * Sus géneros favoritos (hasta 8), cada uno con cuántos títulos tiene. Hoy el
 * número solo estaba en `title`, que no llega al teclado ni al móvil.
 */
export function SalaProfileGenres({ title, items }: { title: string; items: SalaProfileGenre[] }) {
  const titleId = useId()
  if (items.length === 0) return null
  return (
    <section aria-labelledby={titleId} data-sala-profile-genres="" className="font-sala-text text-sala-ink">
      <h2 id={titleId} className="mb-3 sala-type-data">
        {title}
      </h2>
      <ul role="list" className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.genre} className="bg-sala-panel px-3 py-2 sala-type-small [overflow-wrap:anywhere]">
            <span className="font-semibold">{item.genre}</span>
            <span className="text-sala-ink-secondary"> · {item.count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Perfil público `/u/[username]` (P3) ──────────────────────────────────

/**
 * Sus cuatro favoritos en una rejilla (dos columnas en el móvil, cuatro desde
 * `md`), con la nota en la escala de su dueño (`detail`, «Su nota: 9 de 10»):
 * antes decía siempre «de 5». `hint`: lo que le falta al dueño para llenarla.
 */
export function SalaProfileFavorites({
  title,
  items,
  hint,
  priority = false,
}: {
  title: string
  items: SalaProfileItem[]
  hint?: string | null
  /** Primera fila de pósters de la página (REN-6). */
  priority?: boolean
}) {
  const tType = useTranslations('discoverFilters.typeBadge')
  const titleId = useId()
  if (items.length === 0) return null
  return (
    <section aria-labelledby={titleId} data-sala-profile-favorites="" className="font-sala-text text-sala-ink">
      <h2 id={titleId} className="mb-3 sala-type-data">
        {title}
      </h2>
      <ul role="list" className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4">
        {items.map((item) => (
          <li key={item.mediaId} className="min-w-0">
            <SalaWorkCard
              href={hrefOf(item.type, item.mediaId)}
              title={item.title}
              format={item.type as MediaType}
              formatLabel={tType(item.type)}
              poster={item.poster}
              year={item.year}
              detail={item.detail}
              ratio="2/3"
              sizes="(min-width: 768px) 14rem, 45vw"
              priority={priority}
              headingLevel={3}
            />
          </li>
        ))}
      </ul>
      {hint ? <p className="mt-4 text-sala-ink-secondary sala-type-small">{hint}</p> : null}
    </section>
  )
}

/**
 * «benevi te invita a KULTURA» para quien llega sin cuenta con su enlace: la
 * llamada a registrarse de la página (con invitación es la única). No es un
 * encabezado: va antes del `h1`.
 */
export function SalaProfileInvite({ title, text, cta, href }: { title: string; text: string; cta: string; href: string }) {
  const titleId = useId()
  return (
    <aside
      aria-labelledby={titleId}
      data-sala-profile-invite=""
      className="flex flex-col gap-4 bg-sala-panel p-4 font-sala-text text-sala-ink sm:p-6 md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <div className="min-w-0 max-w-prose">
        <p id={titleId} className="sala-type-data [overflow-wrap:anywhere]">
          {title}
        </p>
        <p className="mt-2 text-sala-ink-secondary sala-type-text">{text}</p>
      </div>
      <SalaButton asChild className="shrink-0 self-start md:self-auto">
        <Link href={href}>{cta}</Link>
      </SalaButton>
    </aside>
  )
}

/** «¿Y la tuya?» al final, para quien llega sin cuenta y sin invitación. */
export function SalaProfileCta({ title, text, cta, href }: { title: string; text: string; cta: string; href: string }) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      data-sala-profile-cta=""
      className="flex flex-col gap-4 bg-sala-panel p-4 font-sala-text text-sala-ink sm:p-6 md:flex-row md:items-center md:justify-between md:gap-8"
    >
      <div className="min-w-0 max-w-prose">
        <h2 id={titleId} className="sala-type-data">
          {title}
        </h2>
        <p className="mt-2 text-sala-ink-secondary sala-type-text">{text}</p>
      </div>
      <SalaButton asChild className="shrink-0 self-start md:self-auto">
        <Link href={href}>{cta}</Link>
      </SalaButton>
    </section>
  )
}

/**
 * Un enlace de «Sala» con la caja de 48 px: secundario («Ya tengo cuenta»,
 * «Ver lista») o, en la nota pública (P4), el principal («Ver la ficha»).
 */
export function SalaProfileLinkButton({
  href,
  children,
  variant = 'secondary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
}) {
  return (
    <SalaButton asChild variant={variant}>
      <Link href={href}>{children}</Link>
    </SalaButton>
  )
}

export interface SalaProfileReviewProps {
  /** Quién puntúa: la franja con su color, su avatar y «@nombre» con enlace a su perfil. */
  username: string
  avatarColor: string
  avatarInitials: string
  profileHref: string
  /** «Nota de @benevi para», antes del título en el `h1`. Sin nota (la página genérica), nada. */
  lead: string | null
  title: string
  poster: string | null
  format: MediaType
  /** El formato con palabras, ya traducido. */
  formatLabel: string
  year?: number
  /** La nota en la escala de su dueño, ya compuesta: «Nota» · «9» · «de 10». */
  score: { label: string; value: string; of: string } | null
  /** Texto bajo el título en la página genérica. */
  text?: string | null
  /** Pista para el dueño: quién ve su nota. */
  hint?: string | null
  /** «Ver la ficha» y «Ver el perfil de @…». */
  children?: ReactNode
}

/**
 * La nota pública de una persona sobre una obra (`/u/…/r/…`, fase 8.5 P4): la
 * franja de su dueño como en su perfil, el póster de la obra, el título como
 * rótulo de «Sala» (con el mismo tope de 30 a 72 px que el nombre) y la nota
 * en grande en la escala de quien puntúa. Sin nota (la página genérica), el
 * título y una línea.
 */
export function SalaProfileReview({
  username,
  avatarColor,
  avatarInitials,
  profileHref,
  lead,
  title,
  poster,
  format,
  formatLabel,
  year,
  score,
  text,
  hint,
  children,
}: SalaProfileReviewProps) {
  const band = profileBand(avatarColor)
  const wide = (SALA_POSTER_RATIO[format] ?? '2/3') === '16/9'
  return (
    <article data-sala-review={score ? 'rated' : 'generic'} className="font-sala-text text-sala-ink">
      <div
        data-sala-profile-band=""
        style={band ?? undefined}
        className={cn('flex items-center px-3 py-2 sm:px-4', !band && 'bg-sala-panel text-sala-ink')}
      >
        <Link
          href={profileHref}
          className="inline-flex min-h-sala-target items-center gap-3 text-current no-underline underline-offset-4 sala-type-label hover:underline focus-visible:outline-none focus-visible:sala-focus [overflow-wrap:anywhere]"
        >
          {/* Decorativo: el nombre va escrito al lado. */}
          <span aria-hidden="true" className="shrink-0 border-2 border-current">
            <Avatar initials={avatarInitials} color={avatarColor} size="sm" className="rounded-none font-extrabold" />
          </span>
          @{username}
        </Link>
      </div>
      <div className={cn('mt-6 grid gap-6 md:gap-10', wide ? 'md:grid-cols-[22rem_minmax(0,1fr)]' : 'md:grid-cols-[16rem_minmax(0,1fr)]')}>
        <SalaPoster
          src={poster}
          alt=""
          title={title}
          format={format}
          sizes={wide ? '(min-width: 768px) 22rem, 92vw' : '(min-width: 768px) 16rem, (min-width: 640px) 13rem, 10rem'}
          priority
          className={wide ? 'w-full max-w-md md:max-w-none' : 'w-40 sm:w-52 md:w-full'}
        />
        <div className="flex min-w-0 flex-col gap-5">
          {/* El h1 es el contenedor del rótulo (`container-type`): de su ancho sale el tamaño. */}
          <h1 className="[container-type:inline-size] [overflow-wrap:anywhere]">
            {lead ? <span className="mb-2 block text-sala-ink-secondary sala-type-text">{lead} </span> : null}
            <SalaTitleText title={title} className={cn('block hyphens-none', NOMBRE_ROTULO)} />
          </h1>
          <p className="text-sala-ink-secondary sala-type-small">
            {formatLabel}
            {year ? ` · ${year}` : ''}
          </p>
          {score ? (
            <p data-sala-review-score="" className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sala-ink-secondary sala-type-small">{score.label}</span>{' '}
              <span className="tabular-nums sala-type-heading">{score.value}</span>{' '}
              <span className="sala-type-data">{score.of}</span>
            </p>
          ) : null}
          {text ? <p className="max-w-prose text-sala-ink-secondary sala-type-text">{text}</p> : null}
          {children ? (
            <div data-sala-review-actions="" className="flex flex-wrap items-center gap-3">
              {children}
            </div>
          ) : null}
          {hint ? <p className="max-w-prose text-sala-ink-secondary sala-type-small">{hint}</p> : null}
        </div>
      </div>
    </article>
  )
}
