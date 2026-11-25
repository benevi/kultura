'use client'

// ============================================================
// KULTURA — «Para ti» en «Sala» (fase 8.5 I2b-2, bandera SALA_INICIO)
// Los mismos estados, la misma petición y los mismos textos que
// `AiRecommendations` (la lógica es la misma: `useAiRecommendations`). Solo
// cambia la vista:
// - **Un `h2` visible y siempre el mismo** («Para ti»), con el papel de los
//   demás `h2` de Inicio; antes, la sección se nombraba con `aria-label` y el
//   cartel girado hacía de título. El cartel pasa a una línea de texto junto
//   al encabezado (qué es lo que se ve: elegido por la IA, por afinidad o lo
//   popular), sin pegatina ni emoji.
// - **Nada se pide al montarse** (D-06): «Recomiéndame» es el
//   consentimiento, y debajo sigue la misma línea de privacidad con el mismo
//   enlace a /privacy, sin cambiar una palabra.
// - **Tarjetas de «Sala»** (`SalaWorkList`/`SalaWorkCard`): la carga se
//   anuncia una vez (el mismo «generando»), y las obras sin portada salen con
//   su campo de color.
// - **Error y límite** en un aviso de «Sala» con «Reintentar»; el vacío, en
//   un estado de bloque con su salida a Descubrir.
// - Al llegar el resultado de un clic, el foco pasa al `h2` (el botón que lo
//   tenía desaparece), como hoy pasaba a la sección.
// ============================================================

// Sin importar las hojas de «Sala»: va siempre en la misma página que el
// título de Inicio (`SalaHome`), que ya las trae.

import { useId, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaLink } from '@/components/sala/SalaLink'
import { SalaNotice } from '@/components/sala/SalaNotice'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaWorkList } from '@/components/sala/SalaWorkList'
import { useAiRecommendations, type AiRecsInput } from '@/components/home/useAiRecommendations'
import type { MediaItem } from '@/types/media'

/** La rejilla de «Para ti»: hasta siete obras (una por formato), como hoy. */
const REJILLA = 'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4'
const SIZES = '(min-width: 1024px) 15rem, (min-width: 640px) 30vw, 45vw'
const SKELETONS = 4

function Card({ item }: { item: MediaItem }) {
  const tType = useTranslations('discoverFilters.typeBadge')
  return (
    <SalaWorkCard
      href={`/media/${item.type}/${item.externalId}`}
      title={item.title}
      format={item.type}
      formatLabel={tType(item.type)}
      year={item.year || undefined}
      poster={item.poster ?? null}
      ratio="2/3"
      sizes={SIZES}
      headingLevel={3}
    />
  )
}

export function SalaHomeForYou(props: AiRecsInput) {
  const t = useTranslations('aiRecommendations')
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { recs, source, capped, saved, starter, status, fetchRecs } = useAiRecommendations(props, headingRef)

  // Qué es lo que se ve (el cartel de hoy, como texto): solo con obras o mientras llegan.
  const kind =
    status === 'starter' ? t('starterBadge') : status === 'done' && source === 'match' ? t('matchBadge') : t('aiPickBadge')
  const showList = status === 'done' || status === 'loading' || status === 'starter'

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={status === 'loading'}
      data-sala-home-foryou={status}
      className="font-sala-text text-sala-ink"
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="scroll-mt-24 outline-none sala-type-data">
          {t('title')}
        </h2>
        {showList ? (
          <p data-sala-home-foryou-kind="" className="text-sala-ink-secondary sala-type-small">
            {kind}
          </p>
        ) : null}
      </div>

      {/* Sin petición al montar (D-06): la IA se llama solo con este botón, y la
          línea de abajo dice qué se envía y a quién antes de pulsarlo. */}
      {status === 'idle' ? (
        <div className="flex flex-col items-start gap-4 bg-sala-panel p-4 sm:p-6">
          <div>
            <h3 className="sala-type-label">{t('askTitle')}</h3>
            <p className="mt-1 max-w-prose text-sala-ink-secondary sala-type-text">{t('askHint')}</p>
          </div>
          <SalaButton variant="primary" onClick={fetchRecs} data-sala-home-foryou-ask="">
            {t('askButton')}
          </SalaButton>
          <p className="max-w-prose text-sala-ink-secondary sala-type-small">
            {t('askPrivacy')}{' '}
            <SalaLink href="/privacy">{t('privacyLink')}</SalaLink>
          </p>
        </div>
      ) : null}

      {/* Montada siempre (escondida si no hay obras): su región anuncia «generando»
          al pulsar, y una región que ya existía es la que el lector escucha. */}
      <SalaWorkList
        aria-labelledby={titleId}
        loading={status === 'loading'}
        loadingLabel={t('generating')}
        skeletons={SKELETONS}
        className={showList ? REJILLA : 'hidden'}
      >
          {status === 'done'
            ? recs.map((rec) => {
                // Sin explicación del modelo, el porqué localizado a partir de
                // los géneros del ítem; sin géneros, solo la tarjeta (como hoy).
                const genres = (rec.item.genres ?? []).slice(0, 2)
                const why =
                  rec.reason ?? (genres.length > 0 ? t('whyRecommendedText', { genres: genres.join(', ') }) : null)
                return (
                  <div key={rec.item.id} className="flex flex-col gap-2">
                    <Card item={rec.item} />
                    {why ? <p className="text-sala-ink-secondary sala-type-small">{why}</p> : null}
                  </div>
                )
              })
            : status === 'starter'
              ? starter.map((item) => <Card key={item.id} item={item} />)
              : null}
      </SalaWorkList>

      {status === 'starter' ? (
        <p className="mt-4 text-sala-ink-secondary sala-type-text">
          {t('starterHint')} <SalaLink href="/discover">{t('exploreContent')}</SalaLink>
        </p>
      ) : null}

      {/* Por qué no cambian al volver: valen para todo el día. Si el modelo
          falló no se guardaron: no se promete nada. */}
      {status === 'done' && (capped || saved) ? (
        <p className="mt-4 text-sala-ink-secondary sala-type-small">{capped ? t('cappedNote') : t('dailyNote')}</p>
      ) : null}

      {status === 'empty' ? (
        <SalaBlockState
          headingLevel={3}
          title={t('needMoreItems')}
          description={t('needMoreItemsHint')}
          action={
            <SalaButton asChild variant="secondary">
              <Link href="/discover">{t('exploreContent')}</Link>
            </SalaButton>
          }
        />
      ) : null}

      {/* Montado siempre: el lector anuncia el aviso al entrar (`role="alert"`); el
          aviso va sin papel propio (`live="off"`) para no oírse dos veces. */}
      <div role="alert" data-sala-home-foryou-error="">
        {status === 'error' || status === 'rate_limited' ? (
          <SalaNotice
            tone={status === 'rate_limited' ? 'warning' : 'error'}
            live="off"
            title={status === 'rate_limited' ? t('rateLimited') : t('error')}
            action={
              <SalaButton variant="secondary" onClick={fetchRecs}>
                {t('retry')}
              </SalaButton>
            }
          >
            {t('tryAgainLater')}
          </SalaNotice>
        ) : null}
      </div>
    </section>
  )
}
