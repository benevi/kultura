'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { RecommendModal } from './RecommendModal'
import type { MediaItem } from '@/types/media'

interface RecommendButtonProps {
  item: MediaItem
}

export function RecommendButton({ item }: RecommendButtonProps) {
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
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t('recommend')}
      </Button>
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
