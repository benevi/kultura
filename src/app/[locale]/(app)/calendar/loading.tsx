import { getTranslations } from 'next-intl/server'

/**
 * Esqueleto del calendario mientras se consultan las fechas (la primera carga
 * del día puede pedir varios proveedores). El pulso solo con `motion-safe`;
 * el texto oculto lo anuncia a los lectores de pantalla.
 */
export default async function CalendarLoading() {
  const t = await getTranslations('calendar')
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-8 py-8" aria-busy="true">
      <p role="status" className="sr-only">{t('loading')}</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-9 w-48 bg-surface-elevated rounded-button mb-4" />
        <div className="h-4 w-72 max-w-full bg-surface-elevated rounded-button mb-6" />
        <div className="flex gap-2 mb-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 w-20 rounded-pill bg-surface-elevated" />
          ))}
        </div>
        <div className="h-6 w-32 bg-surface-elevated rounded-button mb-3" />
        <ul className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex gap-4 rounded-20 bg-surface-default p-3">
              <div className="h-[72px] w-12 shrink-0 rounded-xl bg-surface-elevated" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-4 w-1/2 bg-surface-elevated rounded-button" />
                <div className="h-3 w-1/3 bg-surface-elevated rounded-button" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
