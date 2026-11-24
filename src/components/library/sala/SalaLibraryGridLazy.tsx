"use client";

import dynamic from "next/dynamic";

/**
 * La rejilla de la Biblioteca en «Sala» (fase 8.5 B1), por `next/dynamic`
 * mientras dure la bandera `SALA_BIBLIOTECA`: con la bandera apagada la
 * biblioteca no descarga el código de «Sala» ni sus hojas. Se pinta en el
 * servidor igual; solo cambia cómo llega el JS. Al pasar al 100 % (P-Uso),
 * `LibraryClient` puede importar `SalaLibraryGrid` directo.
 */
export const SalaLibraryGridLazy = dynamic(() => import("./SalaLibraryGrid").then((m) => m.SalaLibraryGrid));
