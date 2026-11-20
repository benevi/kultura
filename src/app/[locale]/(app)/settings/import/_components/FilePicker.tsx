import { useRef, useState } from 'react'
import { useImportT } from '@/lib/import/i18n'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import { MAX_IMPORT_ITEMS } from '@/lib/import/limits'
import { ImportHowTo } from './ImportHowTo'
import { ACCEPT, MB } from './shared'
import type { ImportFlow } from './useImportFlow'

type Props = { locale: 'es' | 'en'; compact: boolean } & Pick<ImportFlow, 'phase' | 'parseError' | 'read'>

/** Fase 1: elegir o soltar el archivo (también mientras se lee o si falla). */
export function FilePicker({ locale, compact, phase, parseError, read }: Props) {
  const t = useImportT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <>
      {!compact && (
        <div className="flex flex-col gap-2">
          <p className="font-body text-body text-text-secondary">{t('intro')}</p>
          <p className="font-body text-sm text-text-tertiary">{t('keepNote')}</p>
        </div>
      )}

      <section
        aria-label={t('dropZoneLabel')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void read(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-bento border-2 border-dashed px-5 py-8 text-center transition-colors',
          dragging ? 'border-accent-pink bg-surface-elevated' : 'border-surface-border bg-surface-default'
        )}
      >
        {/* Input oculto y fuera del orden de Tab: lo maneja el botón (patrón de Ajustes). */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => void read(Array.from(e.target.files ?? []))}
        />
        <KButton type="button" size="lg" loading={phase === 'reading'} onClick={() => inputRef.current?.click()}>
          {t('chooseFile')}
        </KButton>
        <p className="font-body text-sm text-text-tertiary">
          {phase === 'reading'
            ? t('reading')
            : t('dropHint', { mb: MB, max: MAX_IMPORT_ITEMS.toLocaleString(locale) })}
        </p>
        <p className="max-w-[52ch] font-body text-xs text-text-tertiary">{t('privacy')}</p>
      </section>

      {parseError && (
        <p role="alert" className="rounded-2xl bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger">
          {t(`parseErrors.${parseError}`, { mb: MB })}
        </p>
      )}

      {!compact && <ImportHowTo />}
    </>
  )
}
