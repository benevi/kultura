"use client";

import dynamic from "next/dynamic";

/**
 * `SalaButton` por `next/dynamic`, para los componentes de cliente que la
 * ficha de hoy y la de «Sala» comparten (añadir a una lista, recomendar,
 * compartir la nota, denunciar, añadir la franquicia; F2c). Con la bandera
 * `SALA_FICHA` apagada no se pinta nunca y su código no se descarga; con ella
 * encendida sale en el HTML del servidor igual. React 19 pasa el `ref` como
 * una prop más, así que llega al botón.
 *
 * Al retirar la ficha vieja (F6), quien lo usa puede importar `SalaButton`.
 */
export const SalaButtonLazy = dynamic(() => import("./SalaButton").then((m) => m.SalaButton));
