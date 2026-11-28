'use client'

import dynamic from 'next/dynamic'

/**
 * El índice de listas en «Sala» (fase 8.5 L1), por `next/dynamic` mientras
 * dure la bandera `SALA_LISTAS`: con la bandera apagada `/lists` no descarga
 * el código de «Sala» ni sus hojas. El `import()` va escrito entero: así Next
 * lo ve al pintar en el servidor y enlaza sus hojas en el HTML. Al pasar al
 * 100 % (P-Uso), la página puede importar `SalaListsIndex` directo.
 */
export const SalaListsIndexLazy = dynamic(() => import('./SalaListsIndex').then((m) => m.SalaListsIndex))
