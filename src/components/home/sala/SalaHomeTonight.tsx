'use client'

// ============================================================
// KULTURA — «Esta noche en tus plataformas» en «Sala» (fase 8.5 I2b-2)
// Los mismos datos que `TonightClient` (los pendientes que el servidor ya
// sabe que están en tus plataformas) y el mismo «Sorpréndeme»: elige uno al
// azar sin repetir el anterior (`pickIndex`), lo anuncia en una frase
// (`role="status"`) y no mueve el foco. Ninguna petición desde el navegador.
//
// Lo que cambia:
// - La fila es la de las demás de Inicio (`SalaHomeRow`): lista con nombre,
//   flechas en escritorio, barra a la vista y tarjetas de «Sala» que no
//   esconden las obras sin portada.
// - «Sorpréndeme» es un `SalaButton` de 48 px; la elegida sale en un panel
//   con su tarjeta (el título es el enlace a la ficha).
// - Sin plataformas o sin nada que ver esta noche: un estado de bloque con su
//   salida a Ajustes.
// ============================================================

// Sin importar las hojas de «Sala»: va siempre en la misma página que el
// título de Inicio (`SalaHome`), que ya las trae.

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaLink } from '@/components/sala/SalaLink'
import { SalaWorkCard, SalaWorkCardSkeleton } from '@/components/sala/SalaWorkCard'
import { IconDice } from '@/components/icons'
import { pickIndex } from '@/lib/home/tonight-pick'
import type { TonightPick } from '@/lib/home/tonight'
import type { MediaType } from '@/types/media'
import { SalaRow as SalaHomeRow, ROW_CARD_SIZES } from '@/components/sala/SalaRow'

function hrefOf(item: TonightPick): string {
  return `/media/${item.type}/${item.mediaId.split('_').slice(1).join('_')}`
}

/** Mientras se consulta (fallback de `Suspense`): el `h2` y la fila, quietos con movimiento reducido. */
export function SalaHomeTonightSkeleton() {
  const t = useTranslations('platforms')
  return (
    <div aria-hidden="true" data-sala-home-tonight-skeleton="" className="font-sala-text text-sala-ink">
      <p className="mb-3 sala-type-data">{t('tonightTitle')}</p>
      <div className="-mx-2 flex gap-4 overflow-hidden px-2 pb-3 pt-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <SalaWorkCardSkeleton key={i} className="w-36 shrink-0 sm:w-40" />
        ))}
      </div>
    </div>
  )
}

/** Sin plataformas guardadas: qué es esto y a dónde ir para ponerlas. */
export function SalaHomeTonightSetup() {
  const t = useTranslations('platforms')
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} data-sala-home-tonight="setup" className="font-sala-text text-sala-ink">
      <h2 id={titleId} className="mb-3 sala-type-data">
        {t('tonightTitle')}
      </h2>
      <div className="flex flex-col items-start gap-4 bg-sala-panel p-4 sm:p-6">
        <p className="max-w-prose sala-type-text">{t('tonightSetup')}</p>
        <SalaButton asChild variant="secondary">
          <Link href="/settings#platforms">{t('tonightSetupCta')}</Link>
        </SalaButton>
      </div>
    </section>
  )
}

export function SalaHomeTonight({ picks, platforms }: { picks: TonightPick[]; platforms: string[] }) {
  const t = useTranslations('platforms')
  const tType = useTranslations('discoverFilters.typeBadge')
  const [index, setIndex] = useState<number | null>(null)
  const pick = index === null ? null : picks[index]

  function surprise() {
    setIndex((prev) => pickIndex(picks.length, prev))
  }

  return (
    <SalaHomeRow
      title={t('tonightTitle')}
      name="tonight"
      count={picks.length}
      description={t('tonightHint', { platforms: platforms.join(', ') })}
      action={
        picks.length > 0 ? (
          <SalaButton variant="secondary" icon={<IconDice aria-hidden="true" className="h-5 w-5" />} onClick={surprise} data-sala-home-surprise="">
            {pick ? t('surpriseAgain') : t('surprise')}
          </SalaButton>
        ) : null
      }
      before={
        <>
          {/* El resultado se anuncia en una frase sin mover el foco del botón; la tarjeta va aparte. */}
          <p role="status" className="sr-only">
            {pick ? t('surprisePick', { title: pick.title, platforms: pick.platforms.join(', ') }) : ''}
          </p>
          {pick ? (
            <div data-sala-home-surprise-pick="" className="mb-4 flex flex-col gap-3 bg-sala-panel p-4 sm:p-6">
              <p className="text-sala-ink-secondary sala-type-small">{t('surpriseLabel')}</p>
              <SalaWorkCard
                variant="row"
                href={hrefOf(pick)}
                title={pick.title}
                format={pick.type as MediaType}
                formatLabel={tType(pick.type)}
                detail={t('surpriseOn', { platforms: pick.platforms.join(', ') })}
                poster={pick.poster}
                ratio="2/3"
                headingLevel={3}
              />
            </div>
          ) : null}
        </>
      }
      after={
        <>
          {picks.length === 0 ? (
            <SalaBlockState
              headingLevel={3}
              title={t('tonightEmpty')}
              description={t('tonightEmptyHint')}
              action={
                <SalaButton asChild variant="secondary">
                  <Link href="/settings#platforms">{t('editPlatforms')}</Link>
                </SalaButton>
              }
            />
          ) : null}
          <p className="mt-2 text-sala-ink-secondary sala-type-small">
            {t('attribution')}
            {picks.length > 0 ? (
              <>
                {' · '}
                <SalaLink href="/settings#platforms">{t('editPlatforms')}</SalaLink>
              </>
            ) : null}
          </p>
        </>
      }
    >
      {picks.map((item) => (
        <SalaWorkCard
          key={item.mediaId}
          href={hrefOf(item)}
          title={item.title}
          format={item.type as MediaType}
          formatLabel={tType(item.type)}
          detail={item.platforms.join(', ')}
          poster={item.poster}
          ratio="2/3"
          sizes={ROW_CARD_SIZES}
          headingLevel={3}
        />
      ))}
    </SalaHomeRow>
  )
}
