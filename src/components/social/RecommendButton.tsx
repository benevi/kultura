'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { SalaButtonLazy as SalaButton } from '@/components/sala/SalaButtonLazy'
import { RecommendModal } from './RecommendModal'
import { SalaRecommendDialogLazy as SalaRecommendDialog } from './sala/SalaSocialDialogsLazy'
import type { MediaItem } from '@/types/media'

interface RecommendButtonProps {
  item: MediaItem
  /**
   * `sala` (ficha con «Sala»): el disparador es un `SalaButton` (F2c) y el
   * diálogo, `SalaDialog` (F2d). Lo que se envía, lo mismo.
   */
  skin?: 'sala'
}

export function RecommendButton({ item, skin }: RecommendButtonProps) {
  const t = useTranslations('recommendations')
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

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

  if (skin === 'sala') {
    return (
      <>
        <SalaButton ref={triggerRef} variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          {t('recommend')}
        </SalaButton>
        <SalaRecommendDialog
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
          mediaId={item.id}
          mediaCache={mediaCache}
        />
      </>
    )
  }

  return (
    <>
      <KButton variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {t('recommend')}
      </KButton>
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
