// C10: esqueleto de Grupos con la forma de `GroupsClient` (pestaña «Mis
// grupos»): título, las dos pestañas, la fila «Mis grupos» con su botón y la
// rejilla de tarjetas (1/2/3 columnas, hueco 5). El pulso solo con
// `motion-safe`; el texto oculto lo anuncia.
import { getTranslations } from 'next-intl/server'

export default async function GroupsLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="page-grid py-8">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-7 h-9 w-40 md:h-11 rounded-button bg-surface-elevated" />
        <div className="flex flex-col gap-6">
          <div className="flex gap-2">
            <div className="h-11 flex-1 rounded-full bg-surface-elevated" />
            <div className="h-11 flex-1 rounded-full bg-surface-elevated" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-6 w-32 rounded-button bg-surface-elevated" />
            <div className="h-9 w-32 rounded-full bg-surface-elevated" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-bento border border-surface-border bg-surface-default p-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-11 w-11 flex-shrink-0 rounded-2xl rounded-bl-lg bg-surface-elevated" />
                  <div className="h-3.5 w-2/3 rounded-button bg-surface-elevated" />
                </div>
                <div className="h-3 w-5/6 rounded-button bg-surface-elevated" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
