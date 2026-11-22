'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { SalaButtonLazy as SalaButton } from '@/components/sala/SalaButtonLazy'
import { RecommendModal } from './RecommendModal'
import type { MediaItem } from '@/types/media'

interface RecommendButtonProps {
  item: MediaItem
  /** `sala`: el disparador es un `SalaButton` (ficha con «Sala», F2c). El diálogo es el mismo. */
  skin?: 'sala'
}

export function RecommendButton({ item, skin }: RecommendButtonProps) {
  const t = useTranslations('recommendations')
  const [open, setOpen] = useState(false)

  const mediaCache = {
    externalId: item.externalId,
    type: item.type,
    title: item.title,
    poster: item.poster,
    backdrop: item.backdrop,
    year: item.year,
    synopsis: item.synopsis,
    genres: item.genres,
  }

  return (
    <>
      {skin === 'sala' ? (
        <SalaButton variant="secondary" onClick={() => setOpen(true)}>
          {t('recommend')}
        </SalaButton>
      ) : (
        <KButton variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {t('recommend')}
        </KButton>
      )}
      {open && (
        <RecommendModal
          mediaId={item.id}
          mediaCache={mediaCache}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
