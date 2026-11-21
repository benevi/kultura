import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
// Contacto para pedir lo que la exportación no incluye (mensajes recibidos):
// el mismo que publica la política de privacidad.
import { LEGAL_CONTACT_EMAIL } from '@/app/.well-known/contact'
import { eyebrow, row, type AccountSettings } from './shared'

type Props = { graceDays: number } & Pick<
  AccountSettings,
  | 'exporting'
  | 'handleExportData'
  | 'importing'
  | 'importInputRef'
  | 'handleImportData'
  | 'importUnresolved'
  | 'openDeleteModal'
>

/** Sección Zona de peligro (D2/D3): exportar, importar y borrar la cuenta. */
export function DangerZoneSection({
  graceDays,
  exporting,
  handleExportData,
  importing,
  importInputRef,
  handleImportData,
  importUnresolved,
  openDeleteModal,
}: Props) {
  const t = useTranslations('settings')

  return (
    <section>
      <p className={cn(eyebrow, 'text-accent-danger')}>{t('dangerZone')}</p>
      <div className="flex flex-col rounded-bento bg-surface-default divide-y divide-surface-border overflow-hidden">
        <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
          <p className="text-sm font-body text-text-tertiary max-w-xs">{t('exportDataHint', { email: LEGAL_CONTACT_EMAIL })}</p>
          <KButton
            variant="secondary"
            size="sm"
            className="flex-shrink-0"
            onClick={handleExportData}
            loading={exporting}
          >
            {t('exportData')}
          </KButton>
        </div>

        <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
          <p className="text-sm font-body text-text-tertiary max-w-xs">{t('importDataHint')}</p>
          {/* El input va oculto y lo dispara el botón: así el control mantiene
              el estilo de KButton (incluido su spinner) en vez del selector de
              archivo del navegador. */}
          {/* Fuera del orden de Tab y del árbol accesible: lo maneja el
              botón visible (antes era una parada de Tab invisible). */}
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleImportData}
          />
          <KButton
            variant="secondary"
            size="sm"
            className="flex-shrink-0"
            onClick={() => importInputRef.current?.click()}
            loading={importing}
          >
            {t('importData')}
          </KButton>
          {importUnresolved > 0 && (
            <p role="status" className="basis-full text-sm font-body text-text-secondary">
              {t('importUnresolved', { count: importUnresolved })}
            </p>
          )}
        </div>

        <div className={cn(row, 'flex items-center justify-between gap-4 flex-wrap')}>
          <p className="text-sm font-body text-text-tertiary max-w-xs">{graceDays > 0 ? t('deleteAccountHintGrace', { days: graceDays }) : t('deleteAccountHint')}</p>
          <KButton
            variant="secondary"
            size="sm"
            className="flex-shrink-0 border-accent-danger/50 text-accent-danger hover:bg-accent-danger/10"
            onClick={openDeleteModal}
          >
            {t('deleteAccount')}
          </KButton>
        </div>
      </div>
    </section>
  )
}
