'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  text: string
}

const CHAR_LIMIT = 280

export function SynopsisSection({ text }: Props) {
  const t = useTranslations('media_detail')
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  const isLong = text.length > CHAR_LIMIT
  const displayed = isLong && !expanded ? text.slice(0, CHAR_LIMIT) + '…' : text

  return (
    <div>
      <p id={textId} className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{displayed}</p>
      {/* Zona táctil de 44 px (2.5.8 / ACC-12) y estado para lector. */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={textId}
          className="inline-flex items-center min-h-11 text-xs font-bold text-accent-info hover:underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
        >
          {expanded ? t('readLess') : t('readMore')}
        </button>
      )}
    </div>
  )
}
