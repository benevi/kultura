import { getTranslations } from 'next-intl/server'

/**
 * MOV-14: esqueleto de la lista de avisos mientras llega la página. El pulso
 * solo con `motion-safe`; el texto oculto lo anuncia a los lectores de
 * pantalla.
 */
export default async function NotificationsLoading() {
  const t = await getTranslations('pwa.loading')
  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-8" aria-busy="true">
      <p role="status" className="sr-only">{t('notifications')}</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-8 w-40 bg-surface-elevated rounded-button mb-6" />
        <ul className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i} className="flex items-start gap-3 rounded-card bg-surface-default border border-surface-border p-4">
              <div className="h-9 w-9 flex-shrink-0 rounded-full bg-surface-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-3/4 bg-surface-elevated rounded-button" />
                <div className="h-3 w-1/4 bg-surface-elevated rounded-button" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
