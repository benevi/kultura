"use client";

import dynamic from "next/dynamic";

/**
 * La biblioteca de la ficha en «Sala» (F2b), por `next/dynamic` mientras
 * dure la bandera `SALA_FICHA`: con la bandera apagada la ficha no descarga
 * el código de los diálogos y avisos de «Sala» (sin esto, +12 KB gzip en la
 * ficha de hoy). Se pinta en el servidor igual; solo cambia cómo llega el JS.
 * Al retirar la ficha vieja (F6), `MediaDetail` puede importarlos directos.
 */
export const SalaLibraryActionLazy = dynamic(() => import("./SalaLibraryAction").then((m) => m.SalaLibraryAction));
export const SalaLibraryCtaLazy = dynamic(() => import("./SalaLibraryCta").then((m) => m.SalaLibraryCta));
