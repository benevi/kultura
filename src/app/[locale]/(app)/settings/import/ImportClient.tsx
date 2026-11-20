'use client'

// ============================================================
// KULTURA — Importar desde otras apps (F-26, D-15)
//
// 1) Elegir o soltar el archivo tal cual lo da la otra app (ZIP, CSV, XML o
//    .xml.gz). Se lee aquí, en el navegador. 2) Vista previa: qué se ha
//    reconocido y cuánto. 3) Importar por lotes con progreso, pausa y
//    reanudación. 4) Resumen, informe CSV descargable y lista de lo que no se
//    pudo emparejar con enlace a la búsqueda.
//
// Lo usan Ajustes → Importar y, en compacto, el paso opcional del onboarding.
// El estado vive en `useImportFlow`; cada fase es una pieza de `_components`.
// ============================================================

import { useImportT } from '@/lib/import/i18n'
import { countResults } from '@/lib/import/run'
import { FilePicker } from './_components/FilePicker'
import { ImportPreview } from './_components/ImportPreview'
import { ImportRunning } from './_components/ImportRunning'
import { ImportDone } from './_components/ImportDone'
import { useImportFlow } from './_components/useImportFlow'

export interface ImportClientProps {
  locale: 'es' | 'en'
  /** Cuenta de la sesión: el avance guardado en este navegador es por cuenta. */
  userId: string
  isDemo?: boolean
  /** Versión del onboarding: sin instrucciones por app ni enlace a la biblioteca. */
  compact?: boolean
  /** Al terminar: cuántos títulos quedan en la biblioteca gracias a la importación. */
  onFinished?: (inLibrary: number) => void
}

export function ImportClient({ locale, userId, isDemo = false, compact = false, onFinished }: ImportClientProps) {
  const t = useImportT()
  const flow = useImportFlow({ userId, isDemo, onFinished })
  const { phase, parsed } = flow

  if (isDemo) {
    return (
      <p role="status" className="rounded-bento bg-surface-default px-5 py-4 font-body text-sm text-text-secondary sm:px-6">
        {t('demo')}
      </p>
    )
  }

  const counts = countResults(flow.results)

  return (
    <div className="flex flex-col gap-5">
      {(phase === 'idle' || phase === 'reading' || phase === 'error') && (
        <FilePicker
          locale={locale}
          compact={compact}
          phase={phase}
          parseError={flow.parseError}
          read={flow.read}
        />
      )}

      {phase === 'preview' && parsed && (
        <ImportPreview
          parsed={parsed}
          ambiguousAs={flow.ambiguousAs}
          chooseAmbiguous={flow.chooseAmbiguous}
          previous={flow.previous}
          start={flow.start}
          startOver={flow.startOver}
          reset={flow.reset}
        />
      )}

      {(phase === 'running' || phase === 'paused') && parsed && (
        <ImportRunning
          parsed={parsed}
          counts={counts}
          phase={phase}
          progress={flow.progress}
          runError={flow.runError}
          results={flow.results}
          start={flow.start}
          pause={flow.pause}
        />
      )}

      {phase === 'done' && parsed && (
        <ImportDone
          locale={locale}
          compact={compact}
          parsed={parsed}
          counts={counts}
          statusRef={flow.statusRef}
          diary={flow.diary}
          results={flow.results}
          start={flow.start}
          reset={flow.reset}
        />
      )}
    </div>
  )
}
