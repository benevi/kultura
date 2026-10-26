// ============================================================
// KULTURA — Secciones de Inicio de F-25 (Server Components)
//
// Las dos van dentro de <Suspense> en la página: «Esta noche en tus
// plataformas» consulta a TMDB y «Actividad reciente» hace dos lecturas; ni
// una ni otra deben retrasar el primer pintado de Inicio.
// ============================================================

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getFriendIds, getFriendsFeed, type FeedEntry } from '@/lib/social/feed'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { PosterImage } from '@/components/media/PosterImage'
import { posterGradient } from '@/lib/images/poster-gradient'
import { platformNames, readPlatforms } from '../settings/platforms'
import { availableTonight, type TonightCandidate } from './tonight'
import { TonightClient } from './TonightClient'

/** Pendientes que se miran (los más recientes); `availableTonight` comprueba 24. */
const TONIGHT_CANDIDATES = 40
const FEED_LIMIT = 8

export async function TonightOnMyPlatforms({ userId, locale }: { userId: string; locale: string }) {
  const supabase = await createClient()
  const platforms = await readPlatforms(supabase, userId, locale)
  if (!platforms) return null
  const t = await getTranslations('platforms')

  if (platforms.services.length === 0) {
    return (
      <section
        aria-labelledby="tonight-setup-title"
        className="flex flex-col items-start gap-3 rounded-bento border border-surface-border bg-surface-default p-6"
      >
        <h2 id="tonight-setup-title" className="font-display text-xl font-bold text-text-primary">
          {t('tonightTitle')}
        </h2>
        <p className="font-body text-sm text-text-secondary">{t('tonightSetup')}</p>
        <KButton asChild size="sm">
          <Link href="/settings#platforms">{t('tonightSetupCta')}</Link>
        </KButton>
      </section>
    )
  }

  const { data } = await supabase
    .from('user_media')
    .select('media_id, media(id, title, poster, type)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(TONIGHT_CANDIDATES)

  type Row = { media_id: string; media: { id: string; title: string; poster: string | null; type: string } | null }
  const candidates: TonightCandidate[] = ((data ?? []) as unknown as Row[])
    .filter((r) => r.media && ['movie', 'tv', 'anime'].includes(r.media.type))
    .map((r) => ({ mediaId: r.media_id, title: r.media!.title, poster: r.media!.poster, type: r.media!.type }))

  const picks = await availableTonight(candidates, platforms.services, platforms.region, locale).catch(() => [])
  return <TonightClient picks={picks} platforms={platformNames(platforms.services, platforms.region)} />
}

export function TonightSkeleton() {
  return (
    <section aria-hidden="true" className="animate-pulse">
      <div className="mb-3 h-5 w-56 rounded-button bg-surface-elevated" />
      <div className="flex gap-5 overflow-x-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[2/3] w-28 flex-shrink-0 rounded-bento bg-surface-elevated md:w-36" />
        ))}
      </div>
    </section>
  )
}

function relativeTime(iso: string, locale: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now
  if (!Number.isFinite(diff)) return ''
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round(diff / 60000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

const STATUS_KEY: Record<FeedEntry['status'], string> = {
  completed: 'activity.completed',
  in_progress: 'activity.in_progress',
  pending: 'activity.pending',
  abandoned: 'activity.abandoned',
}

export async function FriendsActivity({ userId, locale }: { userId: string; locale: string }) {
  const t = await getTranslations('home')
  let friendIds: string[]
  let entries: FeedEntry[]
  try {
    friendIds = await getFriendIds(userId)
    entries = await getFriendsFeed(userId, FEED_LIMIT, friendIds)
  } catch {
    return null
  }

  const visible = entries.filter((e) => e.media)
  return (
    <section aria-labelledby="friends-activity-title" className="flex flex-col gap-3">
      <h2 id="friends-activity-title" className="font-display text-xl font-bold text-text-primary">
        {t('recentActivity')}
      </h2>
      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-bento border border-surface-border bg-surface-default p-6 text-center">
          <p className="font-body text-sm font-medium text-text-primary">
            {friendIds.length === 0 ? t('noFriends') : t('noActivity')}
          </p>
          <p className="font-body text-xs text-text-tertiary">
            {friendIds.length === 0 ? t('noFriendsHint') : t('noActivityHint')}
          </p>
          {friendIds.length === 0 ? (
            <KButton asChild size="sm">
              <Link href="/friends">{t('addFriends')}</Link>
            </KButton>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-bento bg-surface-default">
          {visible.map((entry) => {
            const media = entry.media!
            const href = `/media/${media.type}/${media.id.split('_').slice(1).join('_')}`
            return (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar
                  initials={entry.user.avatar_initials}
                  color={entry.user.avatar_color}
                  size="sm"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="font-body text-sm text-text-secondary">
                    {t.rich(STATUS_KEY[entry.status], {
                      user: entry.user.username,
                      title: media.title,
                      who: (chunks) => (
                        <Link href={`/profile/${entry.user.username}`} className="font-bold text-text-primary hover:underline underline-offset-4">
                          {chunks}
                        </Link>
                      ),
                      what: (chunks) => (
                        <Link href={href} className="font-bold text-text-primary hover:underline underline-offset-4">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </p>
                  <p className="font-body text-xs text-text-tertiary">
                    {typeof entry.score === 'number' && entry.score > 0 ? (
                      <>
                        <span aria-hidden="true" className="text-accent-yellow">★</span>{' '}
                        {t('activityScore', { score: entry.score })}
                        {' · '}
                      </>
                    ) : null}
                    <time dateTime={entry.updatedAt}>{relativeTime(entry.updatedAt, locale)}</time>
                  </p>
                </div>
                <Link href={href} tabIndex={-1} aria-hidden="true" className="flex-shrink-0">
                  <div
                    className="relative h-[60px] w-10 overflow-hidden rounded-md"
                    style={{ background: posterGradient(media.id || media.title) }}
                  >
                    {media.poster ? <PosterImage src={media.poster} sizes="40px" className="object-cover" /> : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function FriendsActivitySkeleton() {
  return (
    <section aria-hidden="true" className="animate-pulse">
      <div className="mb-3 h-5 w-44 rounded-button bg-surface-elevated" />
      <div className="h-40 rounded-bento bg-surface-elevated" />
    </section>
  )
}
