// MOV-14 (F-25): esqueleto de Ajustes (tarjetas de sección como
// `SettingsForm`). El pulso se apaga con reduced-motion.
import { getTranslations } from 'next-intl/server'

export default async function SettingsLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="page-grid [&>*]:max-w-[640px] py-8">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="flex flex-col gap-7 animate-pulse motion-reduce:animate-none">
        <div className="h-9 w-40 rounded-button bg-surface-elevated" />
        {[4, 1, 3, 3].map((rows, section) => (
          <div key={section}>
            <div className="mb-3 h-3 w-24 rounded-button bg-surface-elevated" />
            <div className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-bento bg-surface-default">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5">
                  <div className="h-4 w-40 rounded-button bg-surface-elevated" />
                  <div className="h-8 w-24 rounded-pill bg-surface-elevated" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
