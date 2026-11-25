'use client'

// ============================================================
// KULTURA — El hero «Continuando» de Inicio, en «Sala» (fase 8.5 I2a)
// Lo último que está en curso: su portada, el formato y el año, la sinopsis,
// el progreso con su «+1» y «Continuar». Los mismos datos que `HeroSection`
// (la fila de `user_media` que ya lee la página).
//
// Lo que cambia respecto a hoy:
// - Esquinas rectas, color plano, sin sombras ni pegatina girada (biblia §1).
// - **El encabezado dice qué es.** «Continuando» va dentro del `h2`, delante
//   del título: el lector oye «Continuando, Matrix», no un título suelto.
// - **«Continuar» dice qué continúa.** Es el texto visible (WCAG 2.5.3) y su
//   descripción es el título de la obra.
// - **Imagen rota.** Sin portada, o si falla, el campo de color con el título
//   (`SalaPoster`); antes, un degradado de adorno.
// - El «+1» y el aviso de terminar, en «Sala» (`SalaHomeProgress`).
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { SalaPoster } from '@/components/sala/SalaPoster'
import { SalaButton } from '@/components/sala/SalaButton'
import { progressKindFor } from '@/lib/library/progress'
import type { HeroItem } from '@/components/home/HeroSection'
import { SalaHomeProgress } from './SalaHomeProgress'

export function SalaHomeHero({ item }: { item: HeroItem | null }) {
  const t = useTranslations('home')
  const tType = useTranslations('discoverFilters.typeBadge')
  const titleId = useId()

  // Como hoy: sin nada en curso no hay hero.
  if (!item?.media) return null
  const { media } = item
  const href = `/media/${media.type}/${media.id.split('_').slice(1).join('_')}`

  return (
    <section
      aria-labelledby={titleId}
      data-sala-home-hero=""
      className="flex items-start gap-4 bg-sala-panel p-4 font-sala-text text-sala-ink sm:gap-6 sm:p-6 md:gap-8 md:p-8"
    >
      <SalaPoster
        src={media.poster}
        alt=""
        title={media.title}
        ratio="2/3"
        sizes="(min-width: 768px) 12rem, (min-width: 640px) 10rem, 6rem"
        priority
        className="w-24 shrink-0 sm:w-40 md:w-48"
      />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <h2 id={titleId} className="[overflow-wrap:anywhere]">
          <span className="mb-1 block text-sala-ink-secondary sala-type-label">{t('continuing')}</span>
          {/* El espacio separa las dos partes en el nombre del encabezado. */}
          {' '}
          <span className="block sala-type-heading">{media.title}</span>
        </h2>
        <p className="sala-type-small">
          <span className="mr-1 font-semibold">{tType(media.type)}</span>
          {media.year ? (
            <>
              <span aria-hidden="true">· </span>
              <span className="text-sala-ink-secondary">{media.year}</span>
            </>
          ) : null}
        </p>
        {media.synopsis ? (
          <p className="line-clamp-3 max-w-prose text-sala-ink-secondary sala-type-text">{media.synopsis}</p>
        ) : null}
        {progressKindFor(media.type) !== null ? (
          <SalaHomeProgress
            mediaId={item.media_id}
            mediaType={media.type}
            title={media.title}
            progress={item.progress}
            status={item.status ?? 'in_progress'}
            variant="hero"
          />
        ) : null}
        <SalaButton asChild variant="primary">
          <Link href={href} aria-describedby={titleId}>
            {t('continue')}
          </Link>
        </SalaButton>
      </div>
    </section>
  )
}
