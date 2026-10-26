// ============================================================
// KULTURA — /[locale]/calendar (F-28, PRO-12) · Server Component, con sesión
//
// Próximos episodios de lo que sigues ("En curso"), estrenos de lo que tienes
// pendiente (series, anime, películas en cines o digital en tu región),
// lanzamientos de juegos y capítulos o estrenos de manga. Los datos vienen de
// src/lib/calendar (caché por persona de 1 h y de 6 h por título).
// Sin JavaScript propio: el filtro por formato son enlaces (?type=).
// ============================================================

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Link } from '@/i18n/navigation'
import { PageHeading } from '@/components/layout/PageHeading'
import { IconCalendar } from '@/components/icons'
import { PosterImage } from '@/components/media/PosterImage'
import { posterGradient } from '@/lib/images/poster-gradient'
import { cn } from '@/lib/utils/index'
import { isDemoUser } from '@/lib/demo'
import { createLogger } from '@/lib/logger'
import { getUserCalendar } from '@/lib/calendar/data'
import { dayHeading, describeEvent, laterHeading, sectionize, type CalendarT } from '@/lib/calendar/format'
import { CALENDAR_DAYS_AHEAD, type CalendarEvent, type CalendarResult } from '@/lib/calendar/types'
import { weeklyEmailAllowedFor, weeklyEmailConfig } from '@/lib/email/config'
import { readWeeklyEmailPreference } from '@/lib/email/preferences'
import { markWeeklyReturn, weeklyPeriodFromCampaign } from '@/lib/email/digest'

const log = createLogger('calendar/page')

/** Formatos con fechas en el calendario, en el orden del filtro. */
const FILTER_TYPES = ['tv', 'anime', 'movie', 'game', 'manga'] as const
type FilterType = (typeof FILTER_TYPES)[number]

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('calendar')
  return { title: t('title') }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const FOCUS =
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

export default async function CalendarPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'es'
  const query = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/calendar`)}`)

  // Vuelta desde el correo semanal (medición propia, sin píxel): una vez por semana.
  const period = weeklyPeriodFromCampaign(first(query.utm_source), first(query.utm_campaign))
  if (period && !isDemoUser(user)) {
    after(() => markWeeklyReturn(createAdminClient(), user.id, period))
  }

  const rawType = first(query.type)
  const filter: FilterType | null = FILTER_TYPES.includes(rawType as FilterType) ? (rawType as FilterType) : null

  const config = weeklyEmailConfig()
  const [t, tType, calendar, emailPref] = await Promise.all([
    getTranslations('calendar'),
    getTranslations('discoverFilters.typeBadge'),
    getUserCalendar(supabase, user.id, locale).catch((err): CalendarResult | null => {
      log.error('No se pudo cargar el calendario', { err })
      return null
    }),
    !isDemoUser(user) && weeklyEmailAllowedFor(config, user)
      ? readWeeklyEmailPreference(supabase, user.id)
      : Promise.resolve(null),
  ])
  const tc = t as unknown as CalendarT

  const events = (calendar?.events ?? []).filter((e) => !filter || e.type === filter)
  const sections = calendar ? sectionize(events, calendar.today) : { upcoming: [], later: [], recent: [] }
  const hasAny = sections.upcoming.length + sections.later.length + sections.recent.length > 0

  return (
    <main className="page-grid [&>*]:max-w-3xl py-8">
      <PageHeading icon={IconCalendar}>{t('title')}</PageHeading>
      <p className="-mt-4 mb-6 text-sm text-text-secondary max-w-prose">{t('intro')}</p>

      {calendar && calendar.candidates > 0 ? (
        <nav aria-label={t('filterLabel')} className="mb-6 -mx-4 px-4 overflow-x-auto">
          <ul className="flex gap-2 w-max">
            {[null, ...FILTER_TYPES].map((type) => {
              const active = type === filter
              return (
                <li key={type ?? 'all'}>
                  <Link
                    href={type ? `/calendar?type=${type}` : '/calendar'}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'inline-flex items-center min-h-11 px-4 rounded-pill text-sm font-body font-semibold whitespace-nowrap transition-colors',
                      FOCUS,
                      active
                        ? 'bg-accent-positive text-on-accent-positive'
                        : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {type ? tType(type) : t('filterAll')}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}

      {calendar && (calendar.failed > 0 || calendar.checked < calendar.candidates) ? (
        <div role="status" className="mb-6 flex flex-col gap-1 rounded-bento bg-surface-default px-5 py-4 text-sm text-text-secondary">
          {calendar.failed > 0 ? <p>{t('partial')}</p> : null}
          {calendar.checked < calendar.candidates ? (
            <p>{t('truncated', { checked: calendar.checked, candidates: calendar.candidates })}</p>
          ) : null}
        </div>
      ) : null}

      {!calendar ? (
        <div className="rounded-bento bg-surface-default p-10 text-center text-sm text-text-secondary">{t('partial')}</div>
      ) : calendar.candidates === 0 ? (
        <EmptyState title={t('emptyLibraryTitle')} body={t('emptyLibraryBody')} cta={t('emptyLibraryCta')} href="/discover" />
      ) : !hasAny ? (
        <EmptyState
          title={t('emptyTitle')}
          body={filter ? t('emptyFilter', { days: CALENDAR_DAYS_AHEAD }) : t('emptyBody', { days: CALENDAR_DAYS_AHEAD })}
          cta={t('libraryCta')}
          href="/library"
        />
      ) : (
        <div className="flex flex-col gap-10">
          {sections.upcoming.length > 0 ? (
            <Section id="calendar-upcoming" title={t('upcoming')}>
              {sections.upcoming.map((g) => (
                <DayGroup key={g.day} heading={dayHeading(g.day, calendar.today, tc, locale)} dateTime={g.day}>
                  {g.events.map((e) => (
                    <EventRow key={e.id} event={e} what={describeEvent(e, tc, locale)} typeLabel={tType(e.type)} />
                  ))}
                </DayGroup>
              ))}
            </Section>
          ) : null}

          {sections.recent.length > 0 ? (
            <Section id="calendar-recent" title={t('recent')}>
              {sections.recent.map((g) => (
                <DayGroup key={g.day} heading={dayHeading(g.day, calendar.today, tc, locale)} dateTime={g.day}>
                  {g.events.map((e) => (
                    <EventRow key={e.id} event={e} what={describeEvent(e, tc, locale)} typeLabel={tType(e.type)} />
                  ))}
                </DayGroup>
              ))}
            </Section>
          ) : null}

          {sections.later.length > 0 ? (
            <Section id="calendar-later" title={t('later')}>
              {sections.later.map((g) => (
                <DayGroup key={g.heading.id} heading={laterHeading(g.heading, tc, locale)}>
                  {g.events.map((e) => (
                    <EventRow key={e.id} event={e} what={describeEvent(e, tc, locale)} typeLabel={tType(e.type)} />
                  ))}
                </DayGroup>
              ))}
            </Section>
          ) : null}
        </div>
      )}

      {emailPref && !emailPref.weekly ? (
        <aside
          aria-labelledby="calendar-email-promo"
          className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-bento bg-surface-default px-5 py-5 sm:px-6"
        >
          <div className="flex flex-col gap-1 min-w-0 max-w-md">
            <h2 id="calendar-email-promo" className="font-display text-lg font-bold text-text-primary">
              {t('emailPromoTitle')}
            </h2>
            <p className="text-sm text-text-secondary">{t('emailPromoBody')}</p>
          </div>
          <Link
            href="/settings#email"
            className={cn(
              'inline-flex items-center min-h-11 px-5 rounded-pill bg-surface-elevated text-sm font-bold text-text-primary',
              FOCUS
            )}
          >
            {t('emailPromoCta')}
          </Link>
        </aside>
      ) : null}

      {calendar && calendar.candidates > 0 ? <p className="mt-8 text-xs text-text-tertiary">{t('source')}</p> : null}
    </main>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <h2 id={id} className="text-meta font-extrabold uppercase tracking-wide text-text-tertiary">
        {title}
      </h2>
      {children}
    </section>
  )
}

function DayGroup({ heading, dateTime, children }: { heading: string; dateTime?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-bold first-letter:uppercase text-text-primary">
        {dateTime ? <time dateTime={dateTime}>{heading}</time> : heading}
      </h3>
      <ul className="flex flex-col gap-3">{children}</ul>
    </div>
  )
}

function EventRow({ event, what, typeLabel }: { event: CalendarEvent; what: string; typeLabel: string }) {
  const i = event.mediaId.indexOf('_')
  const href = `/media/${event.mediaId.slice(0, i)}/${encodeURIComponent(event.mediaId.slice(i + 1))}`
  return (
    <li className="flex gap-4 rounded-bento bg-surface-default p-3">
      {/* Portada de tamaño fijo con el gradiente siempre detrás (CLS 0). */}
      <div className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded-lg bg-surface-elevated">
        <div aria-hidden="true" className="absolute inset-0" style={{ background: posterGradient(event.mediaId) }} />
        {event.poster ? <PosterImage src={event.poster} sizes="48px" className="object-cover" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <Link href={href} className={cn('font-body font-semibold text-text-primary hover:underline rounded-lg self-start', FOCUS)}>
          {event.title}
        </Link>
        <p className="text-sm text-text-secondary">{what}</p>
        <p className="text-xs text-text-tertiary">{typeLabel}</p>
      </div>
    </li>
  )
}

function EmptyState({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-bento bg-surface-default px-6 py-14 text-center">
      <h2 className="font-display text-xl font-semibold text-text-primary">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{body}</p>
      <Link
        href={href}
        className={cn('mt-2 inline-flex items-center min-h-11 px-5 rounded-pill bg-accent-pink text-on-accent-pink text-sm font-bold', FOCUS)}
      >
        {cta}
      </Link>
    </div>
  )
}
