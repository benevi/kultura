'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  text: string
  /** Idioma del texto si no es el de la página (`synopsisLang`, WCAG 3.1.2). */
  lang?: string
  /**
   * `sala`: la sinopsis de la ficha con «Sala» (fase 8.5, F2a), con sus
   * tokens. Sin él, la de siempre.
   */
  variant?: 'sala'
  /** Nombre del idioma de `lang` en el de la página («inglés»): la nota de «Sala» (F6). */
  langName?: string | null
}

const CHAR_LIMIT = 280

const CLASSES = {
  text: 'text-sm text-text-secondary leading-relaxed whitespace-pre-line',
  // Zona táctil de 44 px (2.5.8 / ACC-12) y estado para lector.
  toggle:
    'inline-flex items-center min-h-11 text-xs font-bold text-accent-info hover:underline rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink',
}

const SALA_CLASSES = {
  text: 'sala-type-lead max-w-[62ch] whitespace-pre-line [overflow-wrap:anywhere]',
  // Un enlace de texto con el acento (≥ 4,5:1 sobre el fondo de la obra) y 48 px de alto.
  toggle: [
    'mt-2 inline-flex min-h-sala-target items-center sala-type-label text-sala-accent',
    'underline decoration-2 underline-offset-4',
    'transition-colors duration-sala-fast ease-sala motion-reduce:transition-none',
    'sala-hover:text-sala-ink sala-focused:sala-focus',
  ].join(' '),
}

export function SynopsisSection({ text, lang, variant, langName }: Props) {
  const t = useTranslations('media_detail')
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  // Por puntos de código: el corte nunca parte un carácter de fuera del BMP (emoji, CJK ampliado).
  const chars = Array.from(text)
  const isLong = chars.length > CHAR_LIMIT
  const displayed = isLong && !expanded ? chars.slice(0, CHAR_LIMIT).join('') + '…' : text
  const c = variant === 'sala' ? SALA_CLASSES : CLASSES

  // F6: en «Sala», si la sinopsis va en otro idioma (sin sesión no se traduce,
  // decisión de Víctor), una nota discreta lo dice: «Sinopsis en inglés».
  const languageNote = variant === 'sala' && lang ? langName : undefined

  return (
    <div>
      {languageNote && (
        <p data-sala-synopsis-lang="" className="sala-type-small mb-2 text-sala-ink-secondary">
          {t('salaSynopsisLanguage', { language: languageNote })}
        </p>
      )}
      <p id={textId} lang={lang} className={c.text}>{displayed}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={textId}
          className={c.toggle}
        >
          {expanded ? t('readLess') : t('readMore')}
        </button>
      )}
    </div>
  )
}

