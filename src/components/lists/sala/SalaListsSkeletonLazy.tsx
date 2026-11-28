'use client'

import dynamic from 'next/dynamic'

/**
 * El esqueleto del índice de listas en «Sala» (fase 8.5 L1) por
 * `next/dynamic`, en su propio archivo: `loading.tsx` solo trae este cargador
 * y no el del índice. Con la bandera `SALA_LISTAS` apagada no se pinta y su
 * código ni sus hojas se descargan.
 */
export const SalaListsSkeletonLazy = dynamic(() => import('./SalaListsSkeleton').then((m) => m.SalaListsSkeleton))
