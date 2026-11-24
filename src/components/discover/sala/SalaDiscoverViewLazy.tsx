"use client";

import dynamic from "next/dynamic";

/**
 * Descubrir en «Sala» (fase 8.5 D1: buscador, tipos, rejilla y paginación),
 * por `next/dynamic` mientras dure la bandera `SALA_DESCUBRIR`: con la
 * bandera apagada Descubrir no descarga el código de «Sala» ni sus hojas. Al
 * pasar al 100 % (P-Uso), `DiscoverClient` puede importar `SalaDiscoverView`
 * directo.
 */
export const SalaDiscoverViewLazy = dynamic(() => import("./SalaDiscoverView").then((m) => m.SalaDiscoverView));
