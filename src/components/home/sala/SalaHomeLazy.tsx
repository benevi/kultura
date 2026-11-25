'use client'

import dynamic from 'next/dynamic'

/**
 * Inicio en «Sala» (fase 8.5 I1), por `next/dynamic` mientras dure la bandera
 * `SALA_INICIO`: con la bandera apagada Inicio no descarga el código de
 * «Sala» ni sus hojas. Las piezas salen del mismo módulo, así que van
 * en un solo trozo. Cada `import()` va escrito entero: así Next lo ve al
 * pintar en el servidor y enlaza sus hojas en el HTML. Al pasar al 100 % (P-Uso), la página puede importar `SalaHome` directo.
 */
export const SalaHomeTitleLazy = dynamic(() => import('./SalaHome').then((m) => m.SalaHomeTitle))
export const SalaHomeHeroLazy = dynamic(() => import('./SalaHome').then((m) => m.SalaHomeHero))
export const SalaHomeContinueLazy = dynamic(() => import('./SalaHome').then((m) => m.SalaHomeContinue))
export const SalaHomeCircleLazy = dynamic(() => import('./SalaHome').then((m) => m.SalaHomeCircle))
export const SalaHomeNewsLazy = dynamic(() => import('./SalaHome').then((m) => m.SalaHomeNews))
