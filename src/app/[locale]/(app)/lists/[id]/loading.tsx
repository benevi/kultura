// MOV-14 (F-25): esqueleto del detalle de una lista (cabecera + rejilla de
// pósters 2:3, como `ListDetail`). El pulso se apaga con reduced-motion.
import { getTranslations } from 'next-intl/server'

export default async function ListDetailLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="page-grid [&>*]:max-w-4xl py-8">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="flex flex-col gap-10 animate-pulse motion-reduce:animate-none">
        <div className="flex flex-col gap-3">
          <div className="h-10 w-2/3 max-w-md rounded-button bg-surface-elevated" />
          <div className="h-3 w-40 rounded-button bg-surface-elevated" />
          <div className="mt-2 h-9 w-56 rounded-pill bg-surface-elevated" />
        </div>
        <div>
          <div className="mb-4 h-6 w-32 rounded-button bg-surface-elevated" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i}>
                <div className="aspect-[2/3] rounded-2xl bg-surface-elevated" />
                <div className="mt-2 h-3.5 w-3/4 rounded-pill bg-surface-elevated" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
