import { useImportT } from '@/lib/import/i18n'
import { cn } from '@/lib/utils/index'
import type { ImportOutcome } from '@/lib/import/types'

/** Recuento por resultado (solo lo que no es cero). */
export function ImportCounts({ counts }: { counts: Record<ImportOutcome, number> }) {
  const t = useImportT()
  const order: ImportOutcome[] = ['added', 'updated', 'kept', 'unmatched', 'pending', 'excluded', 'invalid']
  return (
    <ul className="flex flex-wrap gap-2">
      {order.map((o) =>
        counts[o] > 0 ? (
          <li
            key={o}
            className={cn(
              'rounded-pill px-3 py-1.5 font-body text-sm font-bold',
              o === 'added' ? 'bg-accent-lime text-on-accent-lime' : 'bg-surface-elevated text-text-primary'
            )}
          >
            {t(`counts.${o}`, { count: counts[o] })}
          </li>
        ) : null
      )}
    </ul>
  )
}
