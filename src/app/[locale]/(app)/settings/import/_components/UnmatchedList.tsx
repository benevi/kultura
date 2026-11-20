import Link from 'next/link'
import { useImportT } from '@/lib/import/i18n'
import type { ImportItem } from '@/lib/import/types'
import { UNMATCHED_SHOWN } from './shared'

/** Lo que no se pudo emparejar, con enlace a buscarlo (las primeras). */
export function UnmatchedList({ locale, unmatched }: { locale: 'es' | 'en'; unmatched: ImportItem[] }) {
  const t = useImportT()
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-body text-sm font-extrabold text-text-primary">{t('unmatchedTitle')}</h3>
      <ul className="flex flex-col divide-y divide-surface-border">
        {unmatched.slice(0, UNMATCHED_SHOWN).map((item) => (
          <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0 font-body text-sm text-text-secondary">
              {item.title}
              {item.year ? ` (${item.year})` : ''}
            </span>
            <Link
              href={`/${locale}/discover?type=${item.kind}&page=1&q=${encodeURIComponent(item.title)}`}
              className="inline-flex min-h-[44px] items-center font-body text-sm font-bold text-accent-pink underline-offset-4 hover:underline"
            >
              {t('searchFor', { title: item.title.length > 40 ? `${item.title.slice(0, 40)}…` : item.title })}
            </Link>
          </li>
        ))}
      </ul>
      {unmatched.length > UNMATCHED_SHOWN ? (
        <p className="font-body text-xs text-text-tertiary">
          {t('unmatchedMore', { count: unmatched.length - UNMATCHED_SHOWN })}
        </p>
      ) : null}
    </div>
  )
}
