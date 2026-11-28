'use client'

import dynamic from 'next/dynamic'

/**
 * El esqueleto de la ficha de una lista en «Sala» (fase 8.5 L3) por
 * `next/dynamic`, en su propio archivo: `loading.tsx` solo trae este cargador.
 * Con la bandera `SALA_LISTAS` apagada no se pinta ni se descarga.
 */
export const SalaListDetailSkeletonLazy = dynamic(() =>
  import('./SalaListDetailSkeleton').then((m) => m.SalaListDetailSkeleton)
)
