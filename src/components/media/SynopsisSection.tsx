'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  text: string
}

const CHAR_LIMIT = 280

export function SynopsisSection({ text }: Props) {
  const t = useTranslations('media_detail')
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > CHAR_LIMIT
  const displayed = isLong && !expanded ? text.slice(0, CHAR_LIMIT) + '…' : text

  return (
    <div>
      <p className="text-sm text-muted leading-relaxed">{displayed}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-accent hover:underline mt-1.5"
        >
          {expanded ? t('readLess') : t('readMore')}
        </button>
      )}
    </div>
  )
}
