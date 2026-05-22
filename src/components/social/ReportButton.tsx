'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

interface Props {
  targetType: 'user' | 'media'
  targetId: string
}

type Status = 'idle' | 'open' | 'sending' | 'sent' | 'error'

export function ReportButton({ targetType, targetId }: Props) {
  const t = useTranslations('report')
  const [status, setStatus] = useState<Status>('idle')
  const [reason, setReason] = useState('')

  async function handleSubmit() {
    setStatus('sending')
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason: reason.trim() || undefined }),
      })
      if (!res.ok) throw new Error()
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <span className="text-xs text-text-tertiary px-2 py-1">{t('sent')}</span>
    )
  }

  if (status === 'idle') {
    return (
      <KButton
        variant="secondary"
        size="sm"
        className="text-xs text-text-tertiary hover:text-accent-danger hover:border-accent-danger"
        onClick={() => setStatus('open')}
      >
        {t('label')}
      </KButton>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-surface-default border border-surface-border rounded-card text-sm">
      <p className="font-medium text-text-primary text-xs">{t('prompt')}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('placeholder')}
        rows={2}
        className="w-full bg-surface-base border border-surface-border rounded-button px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-accent-positive"
      />
      {status === 'error' && (
        <p className="text-xs text-accent-danger">{t('error')}</p>
      )}
      <div className="flex gap-2 justify-end">
        <KButton variant="secondary" size="sm" className="text-xs" onClick={() => setStatus('idle')}>
          {t('cancel')}
        </KButton>
        <KButton
          variant="primary"
          size="sm"
          className="text-xs"
          loading={status === 'sending'}
          onClick={handleSubmit}
        >
          {t('submit')}
        </KButton>
      </div>
    </div>
  )
}
