'use client'

// ============================================================
// KULTURA — «Actividad reciente» de los amigos en «Sala» (fase 8.5 I2b-2)
// Los mismos apuntes que `FriendsActivity` (los lee el servidor, como hoy) y
// los mismos textos. Lo que cambia:
// - Cada apunte es un bloque de panel, sin rayas entre ellos (biblia §1).
// - La portada pequeña ya no es un segundo enlace escondido a la misma ficha:
//   es adorno, y el título dentro de la frase es el enlace.
// - Los enlaces de la frase son de «Sala» (subrayados: el color solo no
//   basta). La nota con su estrella dice el número con palabras, como hoy.
// - Sin amigos o sin actividad: un estado de bloque y, sin amigos, la salida
//   a Amigos como botón de 48 px.
// ============================================================

// Sin importar las hojas de «Sala»: va siempre en la misma página que el
// título de Inicio (`SalaHome`) o, en el perfil de un amigo (fase 8.5 P2), que
// la cabecera de persona (`SalaProfile`), y los dos ya las traen.

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaLink } from '@/components/sala/SalaLink'
import { SalaPoster } from '@/components/sala/SalaPoster'

/** Un apunte, ya preparado en el servidor (con la fecha relativa escrita). */
export interface SalaActivityEntry {
  id: string
  status: 'completed' | 'in_progress' | 'pending' | 'abandoned'
  username: string
  avatarInitials: string
  avatarColor: string | null
  mediaId: string
  mediaTitle: string
  mediaPoster: string | null
  href: string
  score: number | null
  updatedAt: string
  /** «hace 2 horas», ya en el idioma de la página. */
  when: string
}

export type SalaActivityState = 'list' | 'no-friends' | 'no-activity'

export function SalaHomeActivity({ entries, state }: { entries: SalaActivityEntry[]; state: SalaActivityState }) {
  const t = useTranslations('home')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} data-sala-home-activity={state} className="font-sala-text text-sala-ink">
      <h2 id={titleId} className="mb-3 sala-type-data">
        {t('recentActivity')}
      </h2>
      {state === 'list' ? (
        <ul role="list" aria-labelledby={titleId} className="flex list-none flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 bg-sala-panel px-4 py-3">
              <Avatar initials={entry.avatarInitials} color={entry.avatarColor ?? undefined} size="sm" className="shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 [overflow-wrap:anywhere]">
                <p className="sala-type-text">
                  {t.rich(`activity.${entry.status}`, {
                    user: entry.username,
                    title: entry.mediaTitle,
                    who: (chunks) => (
                      <SalaLink href={`/profile/${entry.username}`} className="font-semibold">
                        {chunks}
                      </SalaLink>
                    ),
                    what: (chunks) => (
                      <SalaLink href={entry.href} className="font-semibold">
                        {chunks}
                      </SalaLink>
                    ),
                  })}
                </p>
                <p className="text-sala-ink-secondary sala-type-small">
                  {typeof entry.score === 'number' && entry.score > 0 ? (
                    <>
                      <span aria-hidden="true">★</span> {t('activityScore', { score: entry.score })}
                      {' · '}
                    </>
                  ) : null}
                  <time dateTime={entry.updatedAt}>{entry.when}</time>
                </p>
              </div>
              <SalaPoster
                src={entry.mediaPoster}
                alt=""
                title={entry.mediaTitle}
                fallback="plain"
                sizes="40px"
                aria-hidden="true"
                className="w-10 shrink-0"
              />
            </li>
          ))}
        </ul>
      ) : (
        <SalaBlockState
          headingLevel={3}
          title={state === 'no-friends' ? t('noFriends') : t('noActivity')}
          description={state === 'no-friends' ? t('noFriendsHint') : t('noActivityHint')}
          action={
            state === 'no-friends' ? (
              <SalaButton asChild variant="secondary">
                <Link href="/friends">{t('addFriends')}</Link>
              </SalaButton>
            ) : undefined
          }
        />
      )}
    </section>
  )
}

/** Mientras llega la actividad (fallback de `Suspense`): el `h2` y tres apuntes, quietos con movimiento reducido. */
export function SalaHomeActivitySkeleton() {
  const t = useTranslations('home')
  return (
    <div aria-hidden="true" data-sala-home-activity-skeleton="" className="font-sala-text text-sala-ink">
      <p className="mb-3 sala-type-data">{t('recentActivity')}</p>
      <div className="flex flex-col gap-1 animate-sala-wait motion-reduce:animate-none">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[4.5rem] bg-sala-panel" />
        ))}
      </div>
    </div>
  )
}
