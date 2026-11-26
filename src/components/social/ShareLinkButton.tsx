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
import { SalaButtonLazy as SalaButton } from '@/components/sala/SalaButtonLazy'
import { useToastContext } from '@/components/ui/ToastProvider'
import { preloadShareImage, prepareShareImage, shareNative } from '@/components/pwa/share'

interface ShareLinkButtonProps {
  path: string
  title: string
  label: string
  size?: 'sm' | 'md'
  /**
   * `sala` (perfil con `SALA_PERFIL`, fase 8.5 P2): un `SalaButton`
   * secundario de 48 px. Por `next/dynamic`: sin la bandera no se descarga.
   */
  skin?: 'sala'
}

export function ShareLinkButton({ path, title, label, size = 'sm', skin }: ShareLinkButtonProps) {
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

  if (skin === 'sala') {
    return (
      <SalaButton
        variant="secondary"
        onClick={handleShare}
        onPointerEnter={() => void prepareShareImage(path)}
        onFocus={() => void prepareShareImage(path)}
      >
        {label}
      </SalaButton>
    )
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
