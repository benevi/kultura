// ============================================================
// KULTURA — Piezas del perfil público (/u/{username}, DIS-6)
// Server Components. Solo primitivos de DISENO.md: avatar con la forma del
// perfil, chips (inactivo + punto del matiz de cada formato, TYPE_HUE),
// pegatina lima, pósters con el gradiente de respaldo SIEMPRE detrás, radio
// 18 (el del perfil) y la tarjeta con sombra dura del login para registrarse.
// ============================================================

import { getTranslations, getLocale } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { PosterImage } from '@/components/media/PosterImage'
import { posterGradient } from '@/lib/images/poster-gradient'
import { formatColor } from '@/lib/landing/immersive'
import { Link } from '@/i18n/navigation'
import { IconLibrary } from '@/components/icons'
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

const SECTION_TITLE = 'font-display text-xl md:text-2xl font-extrabold text-text-primary'

function mediaHref(item: PublicCollectionItem): string {
  const externalId = item.mediaId.split('_').slice(1).join('_')
  return `/media/${item.type}/${externalId}`
}

/** Póster con el gradiente de respaldo detrás (nunca un hueco). */
function Poster({
  item,
  sizes,
  priority,
}: {
  item: PublicCollectionItem
  sizes: string
  priority: boolean
}) {
  return (
    <div className="relative aspect-[2/3] rounded-18 overflow-hidden bg-surface-elevated">
      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: posterGradient(item.mediaId || item.title) }}
      >
        <span className="font-display text-lg font-extrabold text-white/90">
          {item.title.slice(0, 2).toUpperCase()}
        </span>
      </div>
      {item.poster ? (
        <PosterImage
          src={item.poster}
          sizes={sizes}
          priority={priority}
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : null}
    </div>
  )
}

// ── Cabecera ────────────────────────────────────────────────────────────

export async function CollectionOwner({
  owner,
  actions,
}: {
  owner: PublicOwner
  actions?: React.ReactNode
}) {
  const t = await getTranslations('collection')
  const locale = await getLocale()
  const since = owner.createdAt && !Number.isNaN(Date.parse(owner.createdAt))
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(owner.createdAt))
    : null

  return (
    <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="flex items-center gap-5 min-w-0">
        <Avatar
          initials={owner.avatarInitials}
          color={owner.avatarColor}
          icon={owner.avatarIcon}
          size="lg"
          className="w-24 h-24 text-[30px] font-extrabold rounded-[28px_28px_28px_8px] flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-text-tertiary">{t('eyebrow')}</p>
          <h1 className="font-display text-[30px] md:text-[42px] font-extrabold tracking-tight text-text-primary leading-tight break-words">
            @{owner.username}
          </h1>
          {since ? <p className="text-sm text-text-tertiary mt-1">{t('memberSince', { date: since })}</p> : null}
          {owner.bio ? (
            <p className="text-[15px] text-text-secondary mt-3 max-w-prose whitespace-pre-line">{owner.bio}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-row flex-wrap items-start gap-3 md:flex-col md:items-end flex-shrink-0">{actions}</div>
      ) : null}
    </header>
  )
}

// ── Invitación ──────────────────────────────────────────────────────────

/** "{username} te invita a KULTURA" (CRE-7), para quien llega sin cuenta con `?ref=`. */
export async function InviteBanner({
  username,
  friendsOnSignup,
  registerHref,
}: {
  username: string
  /** La firma del enlace es válida: al registrarse serán amigos. */
  friendsOnSignup: boolean
  registerHref: string
}) {
  const t = await getTranslations('invite')
  return (
    <section
      aria-labelledby="invite-title"
      className="relative rounded-bento-xl bg-surface-default p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 justify-between"
      style={{
        background:
          'radial-gradient(120% 100% at 20% 10%, oklch(68% 0.24 350 / 0.28) 0%, transparent 55%), var(--surface-default)',
      }}
    >
      <div>
        <h2 id="invite-title" className="font-display text-2xl md:text-3xl font-extrabold text-text-primary">
          {t('bannerTitle', { username })}
        </h2>
        <p className="text-[15px] text-text-secondary mt-2 max-w-prose">
          {friendsOnSignup ? t('bannerFriends') : t('bannerText')}
        </p>
      </div>
      <KButton asChild size="lg" className="flex-shrink-0 self-start md:self-auto">
        <Link href={registerHref}>{t('bannerCta')}</Link>
      </KButton>
    </section>
  )
}

// ── Biblioteca visible: contadores, favoritos y "en curso" ──────────────

export async function FormatCounters({ showcase }: { showcase: LibraryShowcase }) {
  if (showcase.total === 0) return null
  const t = await getTranslations('collection')
  const tm = await getTranslations('media')
  return (
    <section aria-label={t('statsLabel')}>
      <ul className="flex flex-wrap gap-2.5">
        <li className="inline-flex items-center gap-2 rounded-pill bg-surface-elevated px-4 py-2 text-[14px] font-bold text-text-primary">
          <span className="tabular-nums">{t('items', { count: showcase.total })}</span>
          <span className="text-text-tertiary font-semibold">· {t('completedCount', { count: showcase.completed })}</span>
        </li>
        {showcase.byFormat.map((f) => (
          <li
            key={f.type}
            className="inline-flex items-center gap-2 rounded-pill bg-surface-elevated px-4 py-2 text-[14px] font-bold text-text-primary"
          >
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: formatColor(f.type) }} />
            <span className="tabular-nums">{f.count}</span>
            <span className="font-semibold text-text-secondary">{tm(PLURAL_KEY[f.type])}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function FavoritesGrid({
  favorites,
  isOwner,
  priority,
}: {
  favorites: FavoriteItem[]
  isOwner: boolean
  /** Primera fila de pósters de la página: carga con prioridad (REN-6). */
  priority: boolean
}) {
  if (favorites.length === 0 && !isOwner) return null
  const t = await getTranslations('collection')
  const tm = await getTranslations('media')
  // Estado vacío diseñado: el dueño ve los huecos que le faltan y qué hacer.
  const placeholders = isOwner ? Math.max(0, 4 - favorites.length) : 0

  return (
    <section aria-labelledby="favorites-title" className="flex flex-col gap-4">
      <h2 id="favorites-title" className={SECTION_TITLE}>{t('favorites')}</h2>
      <ul className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {favorites.map((item) => (
          <li key={item.mediaId}>
            <Link href={mediaHref(item)} className="group block">
              <div className="relative">
                <Poster item={item} sizes="(max-width: 768px) 45vw, 200px" priority={priority} />
                <span className="absolute left-2 top-2 rotate-[-8deg] rounded-full bg-accent-lime px-3 py-1 text-xs font-extrabold text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,0.4)]">
                  {tm(item.type as MediaType)}
                </span>
              </div>
              <p className="font-display text-[15px] font-bold mt-2.5 line-clamp-2 text-text-primary leading-tight">
                {item.title}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                <span aria-hidden="true" className="text-accent-yellow">★</span>{' '}
                {t('favoriteScore', { score: item.score })}
                {item.year ? ` · ${item.year}` : ''}
              </p>
            </Link>
          </li>
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={`empty-${i}`} aria-hidden={i > 0 ? true : undefined}>
            <Link
              href="/library"
              className="flex aspect-[2/3] items-center justify-center rounded-18 border-2 border-dashed border-surface-border p-4 text-center text-[13px] font-semibold text-text-tertiary hover:text-text-primary hover:border-text-tertiary transition-colors"
              tabIndex={i > 0 ? -1 : undefined}
            >
              {i === 0 ? t('favoritesHint') : <span className="text-2xl">+</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Fila horizontal de pósters (en curso y listas públicas). */
export function PosterStrip({
  items,
  priorityCount = 0,
}: {
  items: PublicCollectionItem[]
  /** Cuántas de las primeras portadas cargan con prioridad (REN-6). */
  priorityCount?: number
}) {
  return (
    <ul className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
      {items.map((item, i) => (
        <li key={item.mediaId} className="w-28 md:w-36 flex-shrink-0">
          <Link href={mediaHref(item)} className="group block">
            <Poster item={item} sizes="(max-width: 768px) 112px, 144px" priority={i < priorityCount} />
            <p className="font-display text-sm font-bold mt-2 line-clamp-2 text-text-primary leading-tight" title={item.title}>
              {item.title}
            </p>
            {item.year ? <p className="font-body text-xs text-text-tertiary mt-0.5">{item.year}</p> : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export async function WatchingRow({ items, priorityCount }: { items: PublicCollectionItem[]; priorityCount: number }) {
  if (items.length === 0) return null
  const t = await getTranslations('collection')
  return (
    <section aria-labelledby="watching-title" className="flex flex-col gap-4">
      <h2 id="watching-title" className={SECTION_TITLE}>{t('watching')}</h2>
      <PosterStrip items={items} priorityCount={priorityCount} />
    </section>
  )
}

// ── Biblioteca no visible para quien mira ───────────────────────────────

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
    <section className="flex flex-col items-center gap-3 rounded-20 bg-surface-default px-6 py-10 text-center">
      <IconLibrary className="w-10 h-10 text-text-tertiary" />
      <h2 className="font-bold text-text-primary">{title}</h2>
      <p className="max-w-md text-sm text-text-secondary">{text}</p>
      {children ? <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </section>
  )
}

// ── Listas públicas ─────────────────────────────────────────────────────

export function FormatLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-4 py-1.5 rounded-pill bg-surface-elevated text-text-primary text-[13px] font-bold">
      {children}
    </span>
  )
}

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
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-bold text-text-primary">{list.name}</h3>
      <PosterStrip items={list.items} priorityCount={priorityCount} />
      <Link
        href={`/u/${username}/l/${list.id}`}
        className="self-start inline-flex items-center min-h-11 text-[13px] font-bold text-text-secondary hover:text-text-primary"
      >
        {t('viewList')} · {t('items', { count: list.items.length })}
      </Link>
    </div>
  )
}

export async function SignUpCta({ href = '/login?mode=register' }: { href?: string }) {
  const t = await getTranslations('collection')
  return (
    <section className="rounded-bento-xl bg-surface-default p-7 md:p-11 shadow-[6px_6px_0_var(--surface-elevated)] md:shadow-[10px_10px_0_var(--surface-elevated)] flex flex-col md:flex-row md:items-center gap-5 justify-between">
      <div>
        <h2 className="font-display text-2xl md:text-3xl font-extrabold text-text-primary">
          {t('ctaTitle')}
        </h2>
        <p className="text-[14px] text-text-secondary mt-2 max-w-prose">{t('ctaText')}</p>
      </div>
      <KButton asChild size="lg" className="flex-shrink-0">
        <Link href={href}>{t('ctaButton')}</Link>
      </KButton>
    </section>
  )
}
