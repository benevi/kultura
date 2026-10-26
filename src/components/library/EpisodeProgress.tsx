'use client'

// ============================================================
// KULTURA — EpisodeProgress (forma antigua, solo episodios)
// Desde F-27 es una capa fina sobre `ProgressInput`, que es el control
// genérico por formato. Se conserva para quien solo maneje el jsonb de
// siempre ({season?, episode}): mismas props y mismo comportamiento (la
// temporada solo cuenta si hay episodio; vaciar el episodio no borra nada).
// ============================================================

import { ProgressInput } from '@/components/library/ProgressInput'
import type { EpisodeProgress as EpisodeProgressType } from '@/types/library'

interface EpisodeProgressProps {
  value: EpisodeProgressType | null
  onChange: (val: EpisodeProgressType | null) => void
  showSeason: boolean
}

export function EpisodeProgress({ value, onChange, showSeason }: EpisodeProgressProps) {
  return (
    <ProgressInput
      mediaType={showSeason ? 'tv' : 'anime'}
      value={value}
      full={false}
      showSeason={showSeason}
      onClear={() => onChange(null)}
      onChange={(next) => {
        // Vaciar el episodio no borra nada (solo «Limpiar progreso»).
        if (!next || typeof next.episode !== 'number') return
        onChange({ season: next.season ?? undefined, episode: next.episode })
      }}
    />
  )
}
