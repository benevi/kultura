import { getTranslations } from 'next-intl/server'

/**
 * MOV-14: esqueleto de la lista de conversaciones mientras llega la página
 * (antes, la pantalla anterior se quedaba congelada sin señal). El pulso solo
 * con `motion-safe`; el texto oculto lo anuncia a los lectores de pantalla.
 */
export default async function ChatLoading() {
  const t = await getTranslations('pwa.loading')
  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-8" aria-busy="true">
      <p role="status" className="sr-only">{t('chat')}</p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="h-8 w-44 bg-surface-elevated rounded-button mb-6" />
        <div className="h-10 w-36 bg-surface-elevated rounded-pill mb-6" />
        <ul className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-card bg-surface-default border border-surface-border p-3">
              <div className="h-11 w-11 flex-shrink-0 rounded-full bg-surface-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 bg-surface-elevated rounded-button" />
                <div className="h-3 w-2/3 bg-surface-elevated rounded-button" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
