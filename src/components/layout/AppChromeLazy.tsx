'use client'

import dynamic from 'next/dynamic'

/**
 * `AppChromeFrame` por `next/dynamic`, para `/u` con «Sala» (fase 8.5 P3): la
 * barra de la app solo se descarga cuando se pinta (con sesión y la bandera).
 * Sale igual en el HTML del servidor.
 */
export const AppChromeLazy = dynamic(() => import('./AppChromeFrame').then((m) => m.AppChromeFrame))
