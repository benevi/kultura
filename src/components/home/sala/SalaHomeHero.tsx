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
//
// I2b:
// - **El color de la obra.** Como en la ficha (biblia §4): ya cargada la
//   portada, su color tiñe el hero (`sala-work`, `SalaPoster` con
//   `readPalette`), ajustado a AA en claro y en oscuro. Todo en el
//   navegador, con la imagen que ya está en pantalla. Mientras llega, si su
//   origen no deja leerla o no da color útil, los neutros.
// - **El título de la obra, como rótulo** (`SalaTitleText`, decisión de
//   Víctor del 25-11-2026): el de la ficha, compuesto para el ancho de la
//   columna. Con tope (`HERO_ROTULO`) para que nunca iguale al `h1` «Inicio»
//   (`heading`, 30–40 px): a cualquier ancho queda por debajo.
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { SalaPoster } from '@/components/sala/SalaPoster'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaTitleText } from '@/components/sala/SalaTitle'
import { SalaScriptFonts } from '@/components/sala/SalaScriptFonts'
import { salaScripts } from '@/lib/design/sala-title'
import { progressKindFor } from '@/lib/library/progress'
import { SALA_WORK_CLASS } from '@/lib/design/sala-palette'
import { cn } from '@/lib/utils/index'
import type { HeroItem } from '@/components/home/HeroSection'
import { SalaHomeProgress } from './SalaHomeProgress'

/**
 * Suelo y tope del rótulo (`--sala-title-floor` y `--sala-title-cap`, las
 * variables de `SALA_TITLE_CSS`), en clases: no baja del papel `data` (22 px)
 * y no llega al `h1` (`heading`: `clamp(1.875rem, 3vw, 2.5rem)`): 2,6vw < 3vw
 * y 36 px < 40 px.
 */
const HERO_ROTULO = '[--sala-title-floor:1.375rem] [--sala-title-cap:clamp(1.375rem,2.6vw,2.25rem)]'

export function SalaHomeHero({ item }: { item: HeroItem | null }) {
  const t = useTranslations('home')
  const tType = useTranslations('discoverFilters.typeBadge')
  const titleId = useId()

  // Como hoy: sin nada en curso no hay hero.
  if (!item?.media) return null
  const { media } = item
  const href = `/media/${media.type}/${media.id.split('_').slice(1).join('_')}`
  const escrituras = salaScripts(media.title)

  return (
    <section
      aria-labelledby={titleId}
      data-sala-home-hero=""
      className={cn(
        SALA_WORK_CLASS,
        'flex items-start gap-4 bg-sala-panel p-4 font-sala-text text-sala-ink sm:gap-6 sm:p-6 md:gap-8 md:p-8'
      )}
    >
      <SalaPoster
        src={media.poster}
        alt=""
        title={media.title}
        ratio="2/3"
        sizes="(min-width: 768px) 12rem, (min-width: 640px) 10rem, 6rem"
        priority
        readPalette
        className="w-24 shrink-0 sm:w-40 md:w-48"
      />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        {/* El h2 es el contenedor del rótulo (`container-type`): de su ancho sale el tamaño. */}
        <h2 id={titleId} className="w-full [container-type:inline-size] [overflow-wrap:anywhere]">
          <span className="mb-1 block text-sala-ink-secondary sala-type-label">{t('continuing')}</span>
          {/* El espacio separa las dos partes en el nombre del encabezado. */}
          {' '}
          {/* Con un título sin espacios (japonés, coreano), `SalaTitleText` pone el nombre tal cual en texto oculto. */}
          <SalaTitleText title={media.title} className={cn('block hyphens-auto', HERO_ROTULO)} />
        </h2>
        {escrituras.length > 0 ? <SalaScriptFonts scripts={escrituras} /> : null}
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
