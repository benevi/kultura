'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  text: string
  /** Idioma del texto si no es el de la página (`synopsisLang`, WCAG 3.1.2). */
  lang?: string
}

const CHAR_LIMIT = 280

export function SynopsisSection({ text, lang }: Props) {
  const t = useTranslations('media_detail')
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  const isLong = text.length > CHAR_LIMIT
  const displayed = isLong && !expanded ? text.slice(0, CHAR_LIMIT) + '…' : text

  return (
    <div>
      <p id={textId} lang={lang} className="max-w-prose whitespace-pre-line break-words text-base leading-relaxed text-text-secondary md:text-body">
        {displayed}
      </p>
      {/* Zona táctil de 44 px (2.5.8 / ACC-12) y estado para lector. */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={textId}
          className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {expanded ? t('readLess') : t('readMore')}
        </button>
      )}
    </div>
  )
}
