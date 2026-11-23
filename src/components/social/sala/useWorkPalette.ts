'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'
import { SALA_WORK_CLASS, paletteFromElement } from '@/lib/design/sala-palette'
import type { ImagePalette } from '@/lib/design/image-palette'

/**
 * La paleta de la obra desde la que se abre un diálogo de «Sala»: el diálogo
 * cuelga de `<body>`, fuera del contenedor `sala-work`, así que se la lleva.
 * Se lee al abrir y antes de pintar (sin un fotograma en neutros). Si el
 * botón no está dentro de una obra, `undefined`: los neutros.
 */
export function useWorkPalette(anchorRef: RefObject<HTMLElement | null> | undefined, open: boolean) {
  const [palette, setPalette] = useState<ImagePalette | undefined>(undefined)
  useLayoutEffect(() => {
    if (open) setPalette(paletteFromElement(anchorRef?.current?.closest<HTMLElement>(`.${SALA_WORK_CLASS}`)))
  }, [open, anchorRef])
  return palette
}
