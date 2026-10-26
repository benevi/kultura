'use client'

// ============================================================
// KULTURA — Texto corto del progreso (F-27): «T2 · E5», «Cap. 34 de 120»,
// «Pág. 120 de 350», «45 %», «12 h de ~22 h». Mismo texto en Inicio, en el
// diálogo y en lo que se anuncia al marcar.
// ============================================================

import { useTranslations } from 'next-intl'
import { progressKindFor, type ProgressValue } from '@/lib/library/progress'

export function useProgressLabel(): (mediaType: string, value: ProgressValue | null | undefined) => string {
  const t = useTranslations('progress')
  return (mediaType, value) => {
    const kind = progressKindFor(mediaType)
    const total = typeof value?.total === 'number' ? value.total : null
    if (!value || !kind) return t('label.none')
    if (kind === 'tv' || kind === 'anime') {
      if (typeof value.episode !== 'number') return t('label.none')
      if (kind === 'tv' && typeof value.season === 'number') {
        return total !== null
          ? t('label.tvOf', { season: value.season, episode: value.episode, total })
          : t('label.tv', { season: value.season, episode: value.episode })
      }
      return total !== null
        ? t('label.episodeOf', { episode: value.episode, total })
        : t('label.episode', { episode: value.episode })
    }
    if (kind === 'reading') {
      const parts: string[] = []
      if (typeof value.chapter === 'number') {
        parts.push(total !== null ? t('label.chapterOf', { chapter: value.chapter, total }) : t('label.chapter', { chapter: value.chapter }))
      }
      if (typeof value.volume === 'number') parts.push(t('label.volume', { volume: value.volume }))
      return parts.length > 0 ? parts.join(' · ') : t('label.none')
    }
    if (kind === 'book') {
      if (typeof value.percent === 'number') return t('label.percent', { percent: value.percent })
      if (typeof value.page === 'number') {
        return total !== null ? t('label.pageOf', { page: value.page, total }) : t('label.page', { page: value.page })
      }
      return t('label.none')
    }
    if (typeof value.hours === 'number') {
      return total !== null ? t('label.hoursOf', { hours: value.hours, total }) : t('label.hours', { hours: value.hours })
    }
    return t('label.none')
  }
}
