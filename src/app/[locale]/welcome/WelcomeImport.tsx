'use client'

// ============================================================
// KULTURA — Paso opcional "Importar" del onboarding (F-26, CRE-6)
//
// Quien llega de Letterboxd, MyAnimeList o Goodreads no tiene que puntuar
// diez títulos a mano: abre el importador aquí mismo (versión compacta) y lo
// importado cuenta para pasar a las recomendaciones. Cerrado por defecto: a
// quien no viene de otra app no le estorba.
// ============================================================

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { AbstractIntlMessages } from 'next-intl'
import { ImportMessages, useImportT } from '@/lib/import/i18n'
import { KButton } from '@/components/ui/KButton'

// El lector de archivos solo se descarga si alguien abre el panel: el resto
// del onboarding no carga con él.
const ImportClient = dynamic(
  () => import('../(app)/settings/import/ImportClient').then((m) => m.ImportClient),
  { ssr: false }
)

interface WelcomeImportProps {
  locale: 'es' | 'en'
  /**
   * Subárbol `import` de los mensajes (lo pasa `welcome/page.tsx`). El paso
   * lleva su PROPIO proveedor: no depende de qué haya por encima de
   * `WelcomeFlow`. Sin textos, el paso opcional no se pinta.
   */
  messages?: AbstractIntlMessages | null
  /** Cuenta de la sesión (el avance guardado es por cuenta). Sin ella, no se pinta. */
  userId?: string | null
  onFinished: (inLibrary: number) => void
}

export function WelcomeImport({ locale, messages, userId, onFinished }: WelcomeImportProps) {
  if (!messages || !userId) return null
  return (
    <ImportMessages locale={locale} messages={messages}>
      <WelcomeImportPanel locale={locale} userId={userId} onFinished={onFinished} />
    </ImportMessages>
  )
}

function WelcomeImportPanel({ locale, userId, onFinished }: { locale: 'es' | 'en'; userId: string; onFinished: (inLibrary: number) => void }) {
  const t = useImportT()
  const [open, setOpen] = useState(false)
  // Una vez abierto se queda montado: cerrar el panel no corta una importación en marcha.
  const [mounted, setMounted] = useState(false)

  return (
    <section aria-labelledby="welcome-import" className="rounded-bento bg-surface-default px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="welcome-import" className="font-display text-lg font-bold text-text-primary">
            {t('welcome.title')}
          </h2>
          <p className="mt-1 max-w-[60ch] font-body text-sm text-text-secondary">{t('welcome.body')}</p>
        </div>
        <KButton
          type="button"
          // Secundario: la acción principal del paso sigue siendo puntuar.
          variant="secondary"
          aria-expanded={open}
          aria-controls="welcome-import-panel"
          className="flex-shrink-0"
          onClick={() => {
            setMounted(true)
            setOpen((v) => !v)
          }}
        >
          {open ? t('welcome.close') : t('welcome.open')}
        </KButton>
      </div>
      <div id="welcome-import-panel" hidden={!open} className="mt-5">
        {mounted && <ImportClient locale={locale} userId={userId} compact onFinished={onFinished} />}
      </div>
    </section>
  )
}
