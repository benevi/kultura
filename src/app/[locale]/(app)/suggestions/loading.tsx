// C10: esqueleto de Sugerencias con la forma de la página: título y subtítulo,
// y la tarjeta de `SuggestionsForm` (tipos, asunto, descripción y botón). El
// pulso solo con `motion-safe`; el texto oculto lo anuncia.
import { getTranslations } from 'next-intl/server'

export default async function SuggestionsLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="page-grid [&>*]:max-w-[640px] py-10">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-8">
          <div className="mb-2 h-20 w-48 md:h-11 rounded-button bg-surface-elevated" />
          <div className="h-5 w-2/3 rounded-button bg-surface-elevated" />
          <div className="mt-2 h-5 w-1/2 rounded-button bg-surface-elevated md:hidden" />
        </div>
        <div className="flex flex-col gap-5 rounded-bento bg-surface-default p-6 sm:p-7">
          <div>
            <div className="mb-2 h-3.5 w-24 rounded-button bg-surface-elevated" />
            <div className="flex flex-wrap gap-2">
              {[72, 88, 64, 80].map((w, i) => (
                <div key={i} className="h-11 rounded-pill bg-surface-elevated" style={{ width: `${w}px` }} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 h-3.5 w-20 rounded-button bg-surface-elevated" />
            <div className="h-14 rounded-2xl bg-surface-elevated" />
          </div>
          <div>
            <div className="mb-2 h-3.5 w-28 rounded-button bg-surface-elevated" />
            <div className="h-36 rounded-2xl bg-surface-elevated" />
            <div className="mt-1 ml-auto h-4 w-10 rounded-button bg-surface-elevated" />
          </div>
          <div className="h-11 w-full rounded-pill bg-surface-elevated" />
        </div>
      </div>
    </main>
  )
}
