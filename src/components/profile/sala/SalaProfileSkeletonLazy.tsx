'use client'

import dynamic from 'next/dynamic'

/**
 * El esqueleto del perfil en «Sala» (fase 8.5 P2) por `next/dynamic`, en su
 * propio archivo: `loading.tsx` solo trae este cargador y no los de la página
 * (`SalaProfileLazy`). Con la bandera `SALA_PERFIL` apagada no se pinta y su
 * código ni sus hojas se descargan.
 */
export const SalaProfileSkeletonLazy = dynamic(() => import('./SalaProfileSkeleton').then((m) => m.SalaProfileSkeleton))
