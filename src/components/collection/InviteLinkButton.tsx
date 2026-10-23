'use client'

// ============================================================
// KULTURA — Botón "Invitar amigos" del perfil público (CRE-7)
// Hoja nativa de compartir en móvil; si no existe, copia el enlace firmado.
// Fuera de `(app)` no hay ToastProvider: el resultado se anuncia en una región
// `role="status"` junto al botón (y, si no se pudo copiar, se enseña el enlace
// para copiarlo a mano).
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

interface Props {
  /** Ruta de la invitación (`/es/u/ana?ref=ana&inv=…`); el origen lo pone el navegador. */
  path: string
}

type Status = 'idle' | 'copied' | 'error'

export function InviteLinkButton({ path }: Props) {
  const t = useTranslations('invite')
  const [status, setStatus] = useState<Status>('idle')
  const [url, setUrl] = useState('')

  async function handleClick() {
    const full = new URL(path, window.location.origin).toString()
    setUrl(full)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('shareTitle'), text: t('shareText'), url: full })
        setStatus('idle')
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(full)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <KButton size="sm" onClick={handleClick}>
        {t('share')}
      </KButton>
      <p role="status" className="text-[13px] text-text-secondary max-w-xs">
        {status === 'copied' ? t('copied') : null}
        {status === 'error' ? (
          <>
            {t('copyError')}{' '}
            <span className="break-all font-semibold text-text-primary select-all">{url}</span>
          </>
        ) : null}
      </p>
    </div>
  )
}
