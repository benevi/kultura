'use client'

import dynamic from 'next/dynamic'

/**
 * La lista pública en «Sala» (fase 8.5 L5), por `next/dynamic` mientras dure
 * la bandera `SALA_LISTAS`: con la bandera apagada `/u/[username]/l/[id]` no
 * descarga el código de «Sala» ni sus hojas. El `import()` va escrito entero
 * para que Next enlace sus hojas en el HTML del servidor.
 */
export const SalaPublicListLazy = dynamic(() => import('./SalaPublicList').then((m) => m.SalaPublicList))
