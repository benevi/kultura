'use client'

// ============================================================
// KULTURA — Botón de compartir enlace
// Hoja nativa de compartir (móvil, con la tarjeta OG si la hay) y, si no
// existe, copia al portapapeles.
// Recibe una RUTA relativa ("/u/ana"); el origen se resuelve en el cliente.
// ============================================================

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { useToastContext } from '@/components/ui/ToastProvider'
import { preloadShareImage, prepareShareImage, shareNative } from '@/components/pwa/share'

interface ShareLinkButtonProps {
  path: string
  title: string
  label: string
  size?: 'sm' | 'md'
}

export function ShareLinkButton({ path, title, label, size = 'sm' }: ShareLinkButtonProps) {
  const t = useTranslations('collection')
  const { show } = useToastContext()

  // La tarjeta OG tiene que estar descargada ANTES del toque (Safari).
  useEffect(() => preloadShareImage(path), [path])

  async function handleShare() {
    const url = new URL(path, window.location.origin).toString()
    // Hoja nativa con la tarjeta OG de la página si la hay (MOV-9). Cancelarla
    // no es un error que enseñar.
    if ((await shareNative({ title, url, imagePath: path })) !== 'unavailable') return
    try {
      await navigator.clipboard.writeText(url)
      show({ message: t('linkCopied'), type: 'success' })
    } catch {
      show({ message: t('linkCopyError'), type: 'error' })
    }
  }

  return (
    <KButton
      variant="secondary"
      size={size}
      onClick={handleShare}
      onPointerEnter={() => void prepareShareImage(path)}
      onFocus={() => void prepareShareImage(path)}
    >
      {label}
    </KButton>
  )
}
