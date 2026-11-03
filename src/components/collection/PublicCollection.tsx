// ============================================================
// KULTURA — Piezas de las páginas públicas de una persona (/u/…)
//
// El perfil, la lista y la nota compartidos son PÁGINAS IMPRESAS del álbum
// (DISENO.md): papel blanco, campos de cian y amarillo que ocupan regiones
// enteras, tinta marina y el rosa solo para la ÚNICA acción de la pantalla
// (la barra fija de abajo para quien llega sin cuenta). Los títulos son
// cromos con su borde blanco (`Cromo`): pegados, puestos «en curso» con su
// tira de progreso o huecos numerados (`Slot`). Las cifras salen de los
// datos y con el formato del idioma; si no hay dato, no hay cifra.
//
// Server Components, salvo `PasteOnEnter` (el pegado escalonado de cada
// rejilla, una vez, al entrar en pantalla).
// ============================================================

import { getTranslations } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { Cromo } from '@/components/album/Cromo'
import { FormatTag } from '@/components/album/FormatTag'
import { NumberBadge } from '@/components/album/NumberBadge'
import { Slot } from '@/components/album/Slot'
import { StatusBand } from '@/components/album/StatusBand'
import { AlbumPage } from '@/components/album/AlbumPage'
import { getAlbumLabels } from '@/components/album/labels.server'
import { FORMAT_COLOR } from '@/lib/design/album'
import { formatCount } from '@/lib/design/format'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/layout/Logo'
import { PasteOnEnter } from '@/components/collection/PasteOnEnter'
import type {
  FavoriteItem,
  LibraryShowcase,
  PublicCollectionItem,
  PublicList,
  PublicOwner,
} from '@/lib/social/public-collection'
import type { MediaType } from '@/types/media'

/** Clave plural de `media` para cada formato ("movies", "tvs"…). */
export const PLURAL_KEY: Record<MediaType, string> = {
  movie: 'movies', tv: 'tvs', anime: 'animes', manga: 'mangas',
  book: 'books', comic: 'comics', game: 'games',
}

/** Foco del sistema (DISENO.md): contorno de 2 px, marino en papel. */
export const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

/** Título de sección de una página impresa: Lilita, sin antetítulo. */
const SECTION_TITLE = 'font-display text-2xl md:text-3xl text-text-primary text-balance'

/** Enlace de texto en papel: tinta marina, subrayado al pasar, 44 px de alto. */
const TEXT_LINK = `inline-flex min-h-11 items-center rounded-lg text-meta font-bold text-text-primary underline-offset-4 hover:underline ${FOCUS}`

function isFormat(type: string): type is MediaType {
  return type in PLURAL_KEY
}

function mediaHref(item: PublicCollectionItem): string {
  const externalId = item.mediaId.split('_').slice(1).join('_')
  return `/media/${item.type}/${externalId}`
}

// ── Barras de la página ─────────────────────────────────────────────────

/**
 * Cabecera de las páginas compartidas: el logotipo y UN botón secundario
 * («Entrar» sin sesión, «Inicio» con ella). Sin «Registrarse» en rosa: la
 * acción de la página es la barra fija de abajo, y en una pantalla solo hay
 * un rosa. Enlaces `<a>` del servidor (no cargan JS); la vuelta tras entrar
 * es esta misma página (`next`).
 */
export async function PublicBar({
  locale,
  signedIn,
  returnTo,
}: {
  locale: string
  signedIn: boolean
  /** Ruta (con idioma) a la que volver tras entrar. */
  returnTo?: string
}) {
  const [tAuth, tNav] = await Promise.all([
    getTranslations({ locale, namespace: 'auth' }),
    getTranslations({ locale, namespace: 'nav' }),
  ])
  const compact = 'h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm'
  const loginHref = `/${locale}/login?mode=login${returnTo ? `&next=${encodeURIComponent(returnTo)}` : ''}`
  return (
    <header className="sticky top-0 z-50 border-b-2 border-surface-border bg-surface-base">
      <div className="page-grid flex h-14 items-center justify-between gap-2">
        <a
          href={signedIn ? `/${locale}/home` : `/${locale}`}
          aria-label="KULTURA"
          className={`flex min-h-11 shrink-0 items-center rounded-lg ${FOCUS}`}
        >
          <Logo size={24} />
        </a>
        <KButton asChild variant="secondary" size="md" className={compact}>
          {signedIn ? (
            <a href={`/${locale}/home`}>{tNav('home')}</a>
          ) : (
            <a href={loginHref}>
              {/* Por debajo de 360 px, la forma corta (como `Header`). */}
              <span className="min-[360px]:hidden">{tAuth('signInAction')}</span>
              <span className="max-[359px]:hidden">{tAuth('signIn')}</span>
            </a>
          )}
        </KButton>
      </div>
    </header>
  )
}

/**
 * La ÚNICA acción en rosa de una página compartida, para quien llega sin
 * cuenta: una barra fija al pie, en la zona del pulgar y con el margen
 * seguro del iPhone. Es `sticky` (no `fixed`): al final de la página se
 * queda en su sitio y nunca tapa el pie. Sin modales. El enlace lleva la
 * atribución y la vuelta a esta página (`next`).
 */
export async function SignUpCta({ href, label }: { href: string; label: string }) {
  const t = await getTranslations('collection')
  return (
    <div
      data-sticky-cta=""
      className="sticky bottom-0 z-40 border-t-2 border-album-navy bg-album-white pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="page-grid flex items-center justify-between gap-4">
        <p className="hidden text-sm font-semibold text-text-secondary sm:block">{t('ctaLine')}</p>
        <KButton asChild size="lg" className="w-full sm:w-auto">
          <Link href={href}>{label}</Link>
        </KButton>
      </div>
    </div>
  )
}

// ── Portada del álbum (cabecera del perfil) ─────────────────────────────

export interface AlbumNumber {
  /** Clave ICU de `collection` con `<n>#</n>` (el número va en su caja). */
  key: 'titlesCount' | 'completedCount' | 'publicListsCount'
  count: number
}

/**
 * Los números del álbum: cada cifra en su caja (como la numeración de un
 * álbum), dentro de su frase ICU («<12> títulos»), así el plural concuerda y
 * el lector lee la frase entera. Solo cifras que salen de los datos y nunca
 * un cero a un desconocido (un álbum vacío no se anuncia).
 */
export async function AlbumNumbers({
  numbers,
  formats = [],
  locale,
}: {
  numbers: AlbumNumber[]
  formats?: Array<{ type: MediaType; count: number }>
  locale: string
}) {
  const shown = numbers.filter((n) => n.count > 0)
  const perFormat = formats.filter((f) => f.count > 0)
  if (shown.length === 0 && perFormat.length === 0) return null
  const [t, tm] = await Promise.all([getTranslations('collection'), getTranslations('media')])
  const badge = (chunks: React.ReactNode) => (
    <NumberBadge n={chunks as string} tone="white" size="md" className="mr-2" />
  )
  return (
    <div className="flex flex-col gap-3">
      {shown.length > 0 ? (
        <ul aria-label={t('statsLabel')} className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {shown.map((n) => (
            <li key={n.key} className="inline-flex items-center text-base font-semibold text-text-primary">
              {t.rich(n.key, { count: n.count, n: badge })}
            </li>
          ))}
        </ul>
      ) : null}
      {perFormat.length > 0 ? (
        <ul aria-label={t('byFormatLabel')} className="flex flex-wrap gap-2">
          {perFormat.map((f) => (
            <li
              key={f.type}
              className="inline-flex h-8 items-center gap-2 rounded-cromo bg-album-white pl-1 pr-3 text-sm font-semibold text-album-navy"
            >
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-cromo bg-album-navy px-1.5 font-numeral text-base leading-none text-album-white">
                {formatCount(f.count, locale)}
              </span>
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: FORMAT_COLOR[f.type] }} />
              {tm(PLURAL_KEY[f.type])}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * La portada del álbum de una persona, en el campo cian: su avatar con el
 * borde blanco de un cromo, «El álbum de @ana» (Lilita, hasta 3 líneas en
 * el móvil), desde cuándo está (solo si se sabe), su bio (las palabras
 * largas se parten y se respetan sus saltos de línea), sus números y las
 * acciones de quien mira.
 */
export async function CollectionOwner({
  owner,
  numbers,
  actions,
  locale,
}: {
  owner: PublicOwner
  numbers?: React.ReactNode
  actions?: React.ReactNode
  locale: string
}) {
  const t = await getTranslations('collection')
  const since =
    owner.createdAt && !Number.isNaN(Date.parse(owner.createdAt))
      ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(owner.createdAt))
      : null

  return (
    <AlbumPage as="header" tone="cyan" className="border-b-2 border-album-navy">
      <div className="flex flex-col gap-6 py-8 md:flex-row md:items-end md:justify-between md:py-12">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
          <Avatar
            initials={owner.avatarInitials}
            color={owner.avatarColor}
            icon={owner.avatarIcon}
            size="lg"
            className="h-20 w-20 shrink-0 rounded-cromo border-[3px] border-album-white text-2xl md:h-28 md:w-28 md:text-3xl"
          />
          <div className="min-w-0">
            <h1 className="break-words font-display text-3xl text-text-primary text-balance [overflow-wrap:anywhere] md:text-5xl">
              {t('heading', { username: owner.username })}
            </h1>
            {since ? <p className="mt-2 text-sm font-semibold text-text-primary">{t('memberSince', { date: since })}</p> : null}
            {owner.bio ? (
              <p className="mt-3 max-w-prose whitespace-pre-line break-words text-base text-text-primary [overflow-wrap:anywhere]">
                {owner.bio}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-start gap-3 md:flex-col md:items-end">{actions}</div> : null}
      </div>
      {numbers ? <div className="pb-8 md:pb-10">{numbers}</div> : null}
    </AlbumPage>
  )
}

// ── Invitación ──────────────────────────────────────────────────────────

/**
 * «Ana te invita a KULTURA» (CRE-7), en una franja amarilla sobre la portada,
 * para quien llega sin cuenta con `?ref=`. No es un encabezado (va antes del
 * h1) y no lleva botón: la acción es la barra fija («Aceptar la invitación»).
 */
export async function InviteBanner({
  username,
  friendsOnSignup,
}: {
  username: string
  /** La firma del enlace es válida: al registrarse serán amigos. */
  friendsOnSignup: boolean
}) {
  const t = await getTranslations('invite')
  return (
    <AlbumPage as="div" tone="yellow" className="border-b-2 border-album-navy">
      <aside aria-labelledby="invite-title" className="flex flex-col gap-1 py-4">
        <p id="invite-title" className="font-display text-xl text-text-primary md:text-2xl">
          {t('bannerTitle', { username })}
        </p>
        <p className="max-w-prose text-sm font-medium text-text-primary">
          {friendsOnSignup ? t('bannerFriends') : t('bannerText')}
        </p>
      </aside>
    </AlbumPage>
  )
}

// ── Biblioteca visible: números, favoritos y «en curso» ─────────────────

/** Los números de la biblioteca (solo con permiso de quien mira, D-04b). */
export async function FormatCounters({ showcase, locale }: { showcase: LibraryShowcase; locale: string }) {
  if (showcase.total === 0) return null
  return (
    <AlbumNumbers
      locale={locale}
      numbers={[
        { key: 'titlesCount', count: showcase.total },
        { key: 'completedCount', count: showcase.completed },
      ]}
      formats={showcase.byFormat}
    />
  )
}

/** Cromo enlazado a su ficha, con el título y una línea de datos debajo. */
function CromoLink({
  item,
  sizes,
  priority,
  state,
  progress,
  progressLabel,
  meta,
  heading: Heading = 'h3',
}: {
  item: PublicCollectionItem
  sizes: string
  priority: boolean
  state?: 'pasted' | 'placed'
  progress?: number
  progressLabel?: string
  meta?: React.ReactNode
  heading?: 'h3' | 'h4' | 'p'
}) {
  return (
    <Link href={mediaHref(item)} className={`group block rounded-cromo ${FOCUS} focus-visible:outline-offset-4`}>
      <Cromo
        seed={item.mediaId}
        title={item.title}
        poster={item.poster}
        sizes={sizes}
        priority={priority}
        state={state}
        format={isFormat(item.type) ? item.type : undefined}
        progress={progress}
        progressLabel={progressLabel}
      />
      <Heading className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-text-primary" title={item.title}>
        {item.title}
      </Heading>
      {meta ? <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-tertiary">{meta}</div> : null}
    </Link>
  )
}

export async function FavoritesGrid({
  favorites,
  isOwner,
  priority,
}: {
  favorites: FavoriteItem[]
  isOwner: boolean
  /** Primera fila de portadas de la página: carga con prioridad (REN-6). */
  priority: boolean
}) {
  if (favorites.length === 0 && !isOwner) return null
  const t = await getTranslations('collection')
  const album = await getAlbumLabels()

  // Dueño sin ninguna nota: una tarjeta compacta, no cuatro huecos vacíos.
  if (favorites.length === 0) {
    return (
      <section aria-labelledby="favorites-title" className="flex flex-col gap-4">
        <h2 id="favorites-title" className={SECTION_TITLE}>{t('favorites')}</h2>
        <div className="flex flex-col gap-3 rounded-bento border-2 border-dashed border-slot-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-secondary">{t('favoritesEmpty')}</p>
          <KButton asChild variant="secondary" size="sm" className="shrink-0 self-start sm:self-auto">
            <Link href="/library">{t('favoritesEmptyAction')}</Link>
          </KButton>
        </div>
      </section>
    )
  }

  // El dueño ve sus huecos libres, numerados: lo que le falta para el top 4.
  const empty = isOwner ? Math.max(0, 4 - favorites.length) : 0

  return (
    <section aria-labelledby="favorites-title" className="flex flex-col gap-4">
      <h2 id="favorites-title" className={SECTION_TITLE}>{t('favorites')}</h2>
      <PasteOnEnter className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 md:gap-x-6">
        {favorites.map((item) => (
          <li key={item.mediaId} className="min-w-0">
            <CromoLink
              item={item}
              sizes="(max-width: 640px) 45vw, 220px"
              priority={priority}
              meta={
                <>
                  {isFormat(item.type) ? <FormatTag format={item.type} label={album.format(item.type)} /> : null}
                  <span className="tabular-nums">{t('favoriteScore', { score: item.score })}</span>
                </>
              }
            />
          </li>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`} className="min-w-0" aria-hidden={i > 0 ? true : undefined}>
            {i === 0 ? (
              <Link href="/library" className={`group block rounded-cromo ${FOCUS}`}>
                <Slot number={favorites.length + 1} title={t('favoritesHint')} />
              </Link>
            ) : (
              <Slot number={favorites.length + 1 + i} title="" />
            )}
          </li>
        ))}
      </PasteOnEnter>
    </section>
  )
}

/** Un título en curso: lo que se sepa de su avance y de cuándo lo tocó. */
export type WatchingItem = PublicCollectionItem & {
  /** Avance de 0 a 1 (si se conoce el total). */
  progress?: number | null
  /** Última vez que se tocó (ISO). */
  updatedAt?: string | null
}

/** «En curso»: cromos puestos sin apretar, con su tira y su «hace N días». */
export async function WatchingRow({
  items,
  priorityCount,
  locale,
}: {
  items: WatchingItem[]
  priorityCount: number
  locale: string
}) {
  if (items.length === 0) return null
  const t = await getTranslations('collection')
  const album = await getAlbumLabels(locale)
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
  return (
    <section aria-labelledby="watching-title" className="flex flex-col gap-4">
      <h2 id="watching-title" className={SECTION_TITLE}>{t('watching')}</h2>
      <PasteOnEnter className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
        {items.map((item, i) => {
          const progress = typeof item.progress === 'number' ? item.progress : undefined
          return (
            <li key={item.mediaId} className="w-32 shrink-0 snap-start md:w-auto">
              <CromoLink
                item={item}
                state="placed"
                progress={progress}
                progressLabel={progress === undefined ? undefined : album.progressPercent(percent.format(progress))}
                sizes="(max-width: 768px) 128px, 160px"
                priority={i < priorityCount}
              />
              {/* La banda solo con la fecha: «En curso» ya lo dice la sección. */}
              {item.updatedAt ? (
                <StatusBand
                  status="in_progress"
                  label={album.status('in_progress')}
                  touchedAt={item.updatedAt}
                  locale={locale}
                  className="mt-2"
                />
              ) : null}
            </li>
          )
        })}
      </PasteOnEnter>
    </section>
  )
}

// ── Biblioteca no visible para quien mira ───────────────────────────────

/** La biblioteca que no se puede ver: un hueco discontinuo con el motivo. */
export function LockedLibrary({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: React.ReactNode
}) {
  return (
    <section className="flex flex-col items-start gap-2 rounded-bento border-2 border-dashed border-slot-line px-5 py-6 md:px-8 md:py-8">
      <h2 className="font-display text-xl text-text-primary text-balance md:text-2xl">{title}</h2>
      <p className="max-w-prose text-sm text-text-secondary">{text}</p>
      {children ? <div className="mt-2 flex flex-wrap items-center gap-3">{children}</div> : null}
    </section>
  )
}

// ── Listas públicas: una página por formato ─────────────────────────────

/** Nombre de un formato (con su punto de color, que nunca va solo). */
export function FormatLabel({ children, format }: { children: React.ReactNode; format?: MediaType }) {
  return (
    <span className="inline-flex items-center gap-2">
      {format ? (
        <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: FORMAT_COLOR[format] }} />
      ) : null}
      {children}
    </span>
  )
}

/** Fila de cromos de una lista (desliza en el móvil, rejilla en escritorio). */
export function CromoStrip({
  items,
  priorityCount = 0,
}: {
  items: PublicCollectionItem[]
  /** Cuántas de las primeras portadas cargan con prioridad (REN-6). */
  priorityCount?: number
}) {
  return (
    <PasteOnEnter className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
      {items.map((item, i) => (
        <li key={item.mediaId} className="w-28 shrink-0 snap-start md:w-auto">
          <CromoLink
            item={item}
            heading="h4"
            sizes="(max-width: 768px) 112px, 160px"
            priority={i < priorityCount}
            meta={item.year ? <span className="tabular-nums">{item.year}</span> : null}
          />
        </li>
      ))}
    </PasteOnEnter>
  )
}

/** Una lista pública dentro de su página de formato. */
export async function PublicListRow({
  list,
  username,
  priorityCount = 0,
}: {
  list: PublicList
  username: string
  priorityCount?: number
}) {
  const t = await getTranslations('collection')
  // Las primeras 12: el resto, en la página de la lista.
  const shown = list.items.slice(0, 12)
  return (
    <article className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="min-w-0 break-words font-display text-xl text-text-primary">{list.name}</h3>
        <Link href={`/u/${encodeURIComponent(username)}/l/${list.id}`} className={TEXT_LINK}>
          {t('viewListCount', { count: list.items.length })}
        </Link>
      </div>
      <CromoStrip items={shown} priorityCount={priorityCount} />
    </article>
  )
}

/** Cabecera de una página de formato: su nombre y cuántas listas tiene. */
export async function FormatPageHeading({
  id,
  name,
  format,
  lists,
}: {
  id: string
  name: string
  format?: MediaType
  lists: number
}) {
  const t = await getTranslations('collection')
  return (
    <div className="flex items-baseline justify-between gap-4 border-b-2 border-album-navy pb-2">
      <h2 id={id} className={SECTION_TITLE}>
        <FormatLabel format={format}>{name}</FormatLabel>
      </h2>
      <span className="shrink-0 text-sm font-semibold text-text-secondary">{t('listsCount', { count: lists })}</span>
    </div>
  )
}
