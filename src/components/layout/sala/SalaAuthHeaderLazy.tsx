'use client'

import dynamic from 'next/dynamic'

/**
 * `SalaAuthHeader` por `next/dynamic` (fase 8.5 M2): la cabecera de «Sala» y
 * sus hojas solo se descargan cuando se pinta (con la bandera `SALA_MARCA`).
 * Sale igual en el HTML del servidor.
 */
export const SalaAuthHeaderLazy = dynamic(() => import('./SalaAuthHeader').then((m) => m.SalaAuthHeader))
