'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  targetType: 'user' | 'media'
  targetId: string
  label?: string
}

type Status = 'idle' | 'open' | 'sending' | 'sent' | 'error'

export function ReportButton({ targetType, targetId, label = 'Reportar' }: Props) {
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
      <span className="text-xs text-muted px-2 py-1">Reporte enviado</span>
    )
  }

  if (status === 'idle') {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted hover:text-red-400 text-xs"
        onClick={() => setStatus('open')}
      >
        {label}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-surface border border-border rounded-lg text-sm">
      <p className="font-medium text-text text-xs">¿Por qué quieres reportar esto?</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Describe el problema (opcional)"
        rows={2}
        className="w-full bg-bg border border-border rounded px-2 py-1.5 text-xs text-text placeholder:text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {status === 'error' && (
        <p className="text-xs text-red-400">Error al enviar el reporte</p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStatus('idle')}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="text-xs"
          loading={status === 'sending'}
          onClick={handleSubmit}
        >
          Enviar reporte
        </Button>
      </div>
    </div>
  )
}
