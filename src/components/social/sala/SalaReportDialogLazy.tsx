"use client";

import dynamic from "next/dynamic";

/**
 * El diálogo de «Sala» de denunciar (F2d) por `next/dynamic`: con la bandera
 * `SALA_FICHA` apagada no se pinta nunca y su código no se descarga (ver
 * `SalaSocialDialogsLazy`). Va en su propio archivo porque `ReportButton`
 * también se usa fuera de la ficha.
 *
 * Al retirar la ficha vieja (F6), `ReportButton` puede importarlo directo.
 */
export const SalaReportDialogLazy = dynamic(() => import("./SalaReportDialog").then((m) => m.SalaReportDialog));
