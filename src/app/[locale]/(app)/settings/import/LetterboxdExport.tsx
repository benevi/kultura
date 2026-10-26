'use client'

// ============================================================
// KULTURA — Exportar a Letterboxd (F-26): dos CSV en su formato de
// importación (vistas con diario y pendientes), por id de TMDB.
// ============================================================

import { useState } from 'react'
import { useImportT } from '@/lib/import/i18n'
import { KButton } from '@/components/ui/KButton'

type List = 'watched' | 'watchlist'

export function LetterboxdExport() {
  const t = useImportT()
  const [busy, setBusy] = useState<List | null>(null)
  const [failed, setFailed] = useState(false)

  async function exportList(list: List) {
    setBusy(list)
    setFailed(false)
    try {
      const res = await fetch(`/api/account/export/letterboxd?list=${list}`)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const name =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `kultura-letterboxd-${list}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="letterboxd-export" className="flex flex-col gap-2">
      <h2 id="letterboxd-export" className="mb-1 text-meta font-extrabold uppercase tracking-wide text-text-tertiary">
        {t('export.title')}
      </h2>
      <div className="flex flex-col gap-4 rounded-bento bg-surface-default px-5 py-5 sm:px-6">
        <p className="font-body text-sm text-text-tertiary">{t('export.body')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <KButton type="button" variant="secondary" loading={busy === 'watched'} disabled={busy !== null} onClick={() => void exportList('watched')}>
            {t('export.watched')}
          </KButton>
          <KButton type="button" variant="secondary" loading={busy === 'watchlist'} disabled={busy !== null} onClick={() => void exportList('watchlist')}>
            {t('export.watchlist')}
          </KButton>
        </div>
        {failed && (
          <p role="alert" className="font-body text-sm text-accent-danger">
            {t('export.error')}
          </p>
        )}
      </div>
    </section>
  )
}
