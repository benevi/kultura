'use client'

// ============================================================
// KULTURA — EpisodeProgress
// Inputs de temporada + episodio para series y anime.
// showSeason=true solo para tv (anime numera globalmente).
// ============================================================

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { CloseButton } from '@/components/ui/CloseButton'
import type { EpisodeProgress as EpisodeProgressType } from '@/types/library'

interface EpisodeProgressProps {
  value: EpisodeProgressType | null
  onChange: (val: EpisodeProgressType | null) => void
  showSeason: boolean
}

export function EpisodeProgress({ value, onChange, showSeason }: EpisodeProgressProps) {
  const t = useTranslations('library')
  const id = useId()
  const seasonId = `${id}-season`
  const episodeId = `${id}-episode`

  function handleEpisodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const episode = parseInt(e.target.value, 10)
    if (!e.target.value || episode < 1) return
    onChange({ season: value?.season, episode })
  }

  function handleSeasonChange(e: React.ChangeEvent<HTMLInputElement>) {
    const ep = value?.episode
    if (!ep) return
    if (!e.target.value) {
      onChange({ episode: ep })
    } else {
      const season = parseInt(e.target.value, 10)
      if (season >= 1) onChange({ season, episode: ep })
    }
  }

  // Borde `--field-border` y anillo de 2 px del sistema (ACC-4); 16 px en
  // móvil para que iOS no haga zoom al enfocar (MOV-5).
  const inputClass =
    'min-h-11 bg-surface-base border border-field-border rounded-button px-3 py-2 text-base md:text-sm font-body text-text-primary placeholder:text-text-tertiary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring transition-colors'

  return (
    <div className="flex items-end gap-4">
      {showSeason && (
        <div className="flex flex-col">
          <label htmlFor={seasonId} className="block text-xs font-body font-medium text-text-secondary mb-1">
            {t('season')}
          </label>
          <input
            id={seasonId}
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            value={value?.season ?? ''}
            onChange={handleSeasonChange}
            className={`${inputClass} w-20`}
            data-testid="input-season"
          />
        </div>
      )}

      <div className="flex flex-col">
        <label htmlFor={episodeId} className="block text-xs font-body font-medium text-text-secondary mb-1">
          {t('episode')}
        </label>
        <input
          id={episodeId}
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          value={value?.episode ?? ''}
          onChange={handleEpisodeChange}
          className={`${inputClass} w-24`}
          data-testid="input-episode"
        />
      </div>

      {value !== null && (
        <CloseButton
          onClick={() => onChange(null)}
          label={t('clearProgress')}
          data-testid="clear-progress"
        />
      )}
    </div>
  )
}
