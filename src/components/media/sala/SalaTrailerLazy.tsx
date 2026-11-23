"use client";

import dynamic from "next/dynamic";

/**
 * El tráiler de «Sala» (F3) por `next/dynamic`, como `SalaLibraryLazy`: con
 * la bandera `SALA_FICHA` apagada la ficha de hoy no descarga su código (ni el
 * de `SalaButton`). Se pinta en el servidor igual. Al retirar la ficha vieja
 * (F6), `MediaDetail` puede importar `SalaTrailer` directo.
 */
export const SalaTrailerLazy = dynamic(() => import("./SalaTrailer").then((m) => m.SalaTrailer));
