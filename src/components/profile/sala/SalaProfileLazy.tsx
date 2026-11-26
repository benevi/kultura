'use client'

import dynamic from 'next/dynamic'

/**
 * Perfil en «Sala» (fase 8.5 P1), por `next/dynamic` mientras dure la bandera
 * `SALA_PERFIL`: con la bandera apagada el perfil no descarga el código de
 * «Sala» ni sus hojas. Las piezas salen del mismo módulo, así que van en un
 * solo trozo. Cada `import()` va escrito entero: así Next lo ve al pintar en
 * el servidor y enlaza sus hojas en el HTML. Al pasar al 100 % (P-Uso), la
 * página puede importar `SalaProfile` directo.
 */
export const SalaProfileHeaderLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileHeader))
export const SalaProfileEditLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileEdit))
export const SalaProfileNumbersLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileNumbers))
export const SalaProfileRowLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileRow))
export const SalaProfileStateLazy = dynamic(() => import('./SalaProfile').then((m) => m.SalaProfileState))
