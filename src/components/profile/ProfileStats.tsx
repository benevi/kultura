// ============================================================
// KULTURA — ProfileStats (Server Component)
// El álbum por formato: una fila por formato con su nombre (punto de color
// + nombre, nunca el color solo), cuántos títulos tiene en su caja de
// número, cuántos ha completado y la tira de lo completado en el color del
// formato (dato, no adorno). Solo formatos con títulos.
// ============================================================

import { getLocale, getTranslations } from 'next-intl/server'
import { FormatTag } from '@/components/album/FormatTag'
import { NumberBadge } from '@/components/album/NumberBadge'
import { ProgressStrip } from '@/components/album/ProgressStrip'
import { FORMATS } from '@/lib/design/album'
import { formatCount } from '@/lib/design/format'
import type { TypeStats } from '@/lib/library/stats'
import type { MediaType } from '@/types/media'

interface ProfileStatsProps {
  byType: TypeStats[]
  totalItems: number
}

const isFormat = (type: string): type is MediaType => (FORMATS as readonly string[]).includes(type)

export async function ProfileStats({ byType, totalItems }: ProfileStatsProps) {
  const t = await getTranslations('profile')
  const tMedia = await getTranslations('media')
  const locale = await getLocale()

  const rows = byType.filter((s) => s.total > 0 && isFormat(s.type))
  if (rows.length === 0 || totalItems === 0) {
    return <p className="text-sm text-text-tertiary">{t('noStats')}</p>
  }

  return (
    <section aria-labelledby="profile-stats-title">
      <h2 id="profile-stats-title" className="mb-4 font-display text-2xl text-text-primary">
        {t('stats')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((s) => (
          <li key={s.type} className="flex items-center gap-4 rounded-bento bg-surface-default px-4 py-3">
            <NumberBadge n={formatCount(s.total, locale)} tone="surface" size="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <FormatTag format={s.type as MediaType} label={tMedia(s.type)} className="text-sm text-text-primary" />
                <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
                  {t('completedCount', { count: s.completed })}
                </span>
              </div>
              <ProgressStrip value={s.completed / s.total} format={s.type as MediaType} className="overflow-hidden rounded-cromo" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
