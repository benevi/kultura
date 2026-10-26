// MOV-14 (F-25): esqueleto de «Mis listas» con la misma rejilla que la página
// (sin salto al llegar los datos). El pulso se apaga con reduced-motion.
import { getTranslations } from 'next-intl/server'

export default async function ListsLoading() {
  const t = await getTranslations('common')
  return (
    <main aria-busy="true" className="max-w-5xl mx-auto px-4 md:px-8 py-8">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="h-9 w-48 rounded-button bg-surface-elevated" />
          <div className="h-9 w-28 rounded-pill bg-surface-elevated" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i}>
              <div className="h-[150px] rounded-bento bg-surface-elevated" />
              <div className="mt-3 h-3 w-24 rounded-button bg-surface-elevated" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
