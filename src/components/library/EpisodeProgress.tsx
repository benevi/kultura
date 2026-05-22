'use client'

// ============================================================
// KULTURA — EpisodeProgress
// Inputs de temporada + episodio para series y anime.
// showSeason=true solo para tv (anime numera globalmente).
// ============================================================

import { useTranslations } from 'next-intl'
import type { EpisodeProgress as EpisodeProgressType } from '@/types/library'

interface EpisodeProgressProps {
  value: EpisodeProgressType | null
  onChange: (val: EpisodeProgressType | null) => void
  showSeason: boolean
}

export function EpisodeProgress({ value, onChange, showSeason }: EpisodeProgressProps) {
  const t = useTranslations('library')

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

  const inputClass =
    'bg-surface-base border border-surface-border rounded-button px-3 py-2 text-sm font-body text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent-positive focus-visible:ring-1 focus-visible:ring-accent-positive/40 transition-colors'

  return (
    <div className="flex items-end gap-4">
      {showSeason && (
        <div className="flex flex-col">
          <label className="block text-xs font-body font-medium text-text-secondary mb-1">
            {t('season')}
          </label>
          <input
            type="number"
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
        <label className="block text-xs font-body font-medium text-text-secondary mb-1">
          {t('episode')}
        </label>
        <input
          type="number"
          min={1}
          max={9999}
          value={value?.episode ?? ''}
          onChange={handleEpisodeChange}
          className={`${inputClass} w-24`}
          data-testid="input-episode"
        />
      </div>

      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-text-tertiary hover:text-text-primary text-sm pb-2 self-end leading-none transition-colors"
          aria-label={t('clearProgress')}
          data-testid="clear-progress"
        >
          ×
        </button>
      )}
    </div>
  )
}
