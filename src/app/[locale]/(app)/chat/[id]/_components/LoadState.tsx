import { useTranslations } from 'next-intl'

/**
 * Estado de carga y errores: fuera del log, para que este solo anuncie
 * mensajes nuevos.
 */
export function LoadState({
  loading,
  loadError,
  onRetry,
}: {
  loading: boolean
  loadError: boolean
  onRetry: () => void
}) {
  const t = useTranslations('chat')

  return (
    <>
      {loading && (
        <p role="status" className="text-center text-sm text-text-secondary py-8">{t('loadingMessages')}</p>
      )}
      {!loading && loadError && (
        <div role="alert" className="text-center py-8 flex flex-col items-center gap-3">
            <p className="text-sm text-text-secondary">{t('loadError')}</p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 px-4 py-1.5 rounded-full bg-surface-elevated border border-surface-border text-sm text-text-primary hover:bg-surface-default transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            {t('retry')}
          </button>
        </div>
      )}
    </>
  )
}
