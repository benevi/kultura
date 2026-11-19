// C10: esqueleto del detalle de un grupo. Sin él heredaría el de `groups/`
// (rejilla de tarjetas), que no se parece a esta página: portada con icono,
// nombre y miembros apilados; muro (2/3) y lista de miembros (1/3). El pulso
// solo con `motion-safe`; el texto oculto lo anuncia.
import { getTranslations } from 'next-intl/server'

export default async function GroupDetailLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="page-grid [&>*]:max-w-3xl py-8">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="flex flex-col gap-8 motion-safe:animate-pulse">
        <div className="flex items-start gap-4 rounded-bento-xl bg-surface-elevated p-6 md:py-9 md:px-10">
          <div className="h-14 w-14 flex-shrink-0 rounded-2xl rounded-bl-lg bg-surface-default" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-8 w-1/2 rounded-button bg-surface-default" />
            <div className="h-3.5 w-2/3 rounded-button bg-surface-default" />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`h-10 w-10 rounded-full bg-surface-default ${i > 0 ? '-ml-3' : ''}`} />
                ))}
              </div>
              <div className="h-3.5 w-20 rounded-button bg-surface-default" />
            </div>
          </div>
          <div className="h-9 w-24 flex-shrink-0 rounded-full bg-surface-default" />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-4 md:col-span-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-bento bg-surface-default" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-6 w-24 rounded-button bg-surface-elevated" />
            <div className="overflow-hidden rounded-bento border border-surface-border bg-surface-default">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 border-t border-surface-border px-3 py-2.5 first:border-t-0">
                  <div className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-elevated" />
                  <div className="h-3.5 w-24 rounded-button bg-surface-elevated" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
