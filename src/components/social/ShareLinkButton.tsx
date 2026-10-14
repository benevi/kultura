'use client'

// ============================================================
// KULTURA — Botón de compartir enlace
// Hoja nativa de compartir (móvil) y, si no existe, copia al portapapeles.
// Recibe una RUTA relativa ("/u/ana"); el origen se resuelve en el cliente.
// ============================================================

import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { useToastContext } from '@/components/ui/ToastProvider'

interface ShareLinkButtonProps {
  path: string
  title: string
  label: string
  size?: 'sm' | 'md'
}

export function ShareLinkButton({ path, title, label, size = 'sm' }: ShareLinkButtonProps) {
  const t = useTranslations('collection')
  const { show } = useToastContext()

  async function handleShare() {
    const url = new URL(path, window.location.origin).toString()
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch (err) {
        // Cancelar la hoja nativa no es un error que enseñar.
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      show({ message: t('linkCopied'), type: 'success' })
    } catch {
      show({ message: t('linkCopyError'), type: 'error' })
    }
  }

  return (
    <KButton variant="secondary" size={size} onClick={handleShare}>
      {label}
    </KButton>
  )
}
