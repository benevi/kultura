// C10: esqueleto de una conversación. Sin él heredaría el de `chat/` (lista de
// conversaciones con título y botón), que no se parece a esta pantalla: aquí
// van la cabecera con la persona, el hueco de los mensajes y el campo de
// escribir, a toda la altura y con las mismas medidas que `ConversationClient`.
// El centro se deja vacío porque `ConversationClient` arranca ahí con su propio
// «Cargando mensajes…»; así nada cambia de sitio al llegar la página. Ese texto
// también es `role="status"`, así que aquí se anuncia otro («Abriendo la
// conversación…») para no repetir el mismo dos veces. El pulso solo con
// `motion-safe`.
import { getTranslations } from 'next-intl/server'

export default async function ConversationLoading() {
  const t = await getTranslations('chat')
  return (
    <main aria-busy="true" className="page-grid max-md:px-0 [&>*]:max-w-2xl">
      <p role="status" className="sr-only">{t('openingConversation')}</p>
      <div
        aria-hidden="true"
        className="flex flex-col h-[calc(100dvh-56px-4rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-56px)] motion-safe:animate-pulse"
      >
        <div className="flex items-center gap-3 border-b border-surface-border bg-surface-default px-4 py-3">
          <div className="-ml-2 h-11 w-11 flex-shrink-0 rounded-full" />
          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-elevated" />
          <div className="h-3.5 w-28 rounded-button bg-surface-elevated" />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 border-t border-surface-border bg-surface-default px-4 py-3">
          <div className="h-11 flex-1 rounded-full bg-surface-elevated" />
          <div className="h-11 w-11 flex-shrink-0 rounded-full bg-surface-elevated" />
        </div>
      </div>
    </main>
  )
}
