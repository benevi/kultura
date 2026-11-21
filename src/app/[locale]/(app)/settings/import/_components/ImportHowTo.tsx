import { useImportT } from '@/lib/import/i18n'
import { IMPORT_SOURCES } from '@/lib/import/types'

/** Cómo sacar el archivo de cada app (desplegables). */
export function ImportHowTo() {
  const t = useImportT()
  return (
    <section aria-labelledby="import-howto" className="flex flex-col gap-2">
      <h2 id="import-howto" className="mb-1 text-meta font-extrabold uppercase tracking-wide text-text-tertiary">
        {t('howTo')}
      </h2>
      <div className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-bento bg-surface-default">
        {IMPORT_SOURCES.map((source) => (
          <details key={source} className="group px-5 py-4 sm:px-6">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-body text-sm font-bold text-text-primary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
              {t(`sources.${source}.name`)}
              <span aria-hidden="true" className="text-text-tertiary transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="pb-1 pt-2 font-body text-sm text-text-secondary">{t(`sources.${source}.how`)}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
