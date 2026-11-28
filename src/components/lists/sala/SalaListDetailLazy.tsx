'use client'

import dynamic from 'next/dynamic'

/**
 * La ficha de una lista en «Sala» (fase 8.5 L3), por `next/dynamic` mientras
 * dure la bandera `SALA_LISTAS`: con la bandera apagada `/lists/[id]` no
 * descarga el código de «Sala» ni sus hojas. El `import()` va escrito entero
 * para que Next enlace sus hojas en el HTML del servidor.
 */
export const SalaListDetailLazy = dynamic(() => import('./SalaListDetail').then((m) => m.SalaListDetail))
